import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { z } from "zod";
import { env, requireEnv } from "./env";
import { usageForDay, recordUsage, isOverBudget } from "./usage";
import { captureError } from "./observability";

/**
 * LLM wrapper. All LLM calls go through here so we get: provider abstraction
 * (Anthropic default, OpenAI alternate via LLM_PROVIDER), strict JSON output
 * validated by zod (with a single repair retry), token logging, and a cheap
 * two-level budget guard (per request + per user per day).
 */

// ── Generic message shape (provider-agnostic) ──────────────
type Role = "user" | "assistant";
type Msg = { role: Role; content: string };
type ModelResponse = { text: string; tokens: number };

// ── Clients (lazy) ─────────────────────────────────────────
let anthropic: Anthropic | null = null;
let openai: OpenAI | null = null;

function anthropicClient(): Anthropic {
  if (!anthropic) {
    anthropic = new Anthropic({
      apiKey: requireEnv("ANTHROPIC_API_KEY", "LLM analysis (Anthropic)"),
    });
  }
  return anthropic;
}

function openaiClient(): OpenAI {
  if (!openai) {
    openai = new OpenAI({
      apiKey: requireEnv("OPENAI_API_KEY", "LLM analysis (OpenAI)"),
    });
  }
  return openai;
}

function activeModel(): string {
  return env.LLM_PROVIDER === "openai" ? env.OPENAI_MODEL : env.ANTHROPIC_MODEL;
}

async function callProvider(
  system: string,
  messages: Msg[],
  maxTokens: number,
): Promise<ModelResponse> {
  if (env.LLM_PROVIDER === "openai") {
    // response_format json_object requires the word "json" in the prompt — our
    // system prompt already asks for a JSON object.
    const res = await openaiClient().chat.completions.create({
      model: env.OPENAI_MODEL,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: system }, ...messages],
    });
    return {
      text: res.choices[0]?.message?.content ?? "",
      tokens: res.usage?.total_tokens ?? 0,
    };
  }

  const res = await anthropicClient().messages.create({
    model: env.ANTHROPIC_MODEL,
    max_tokens: maxTokens,
    system,
    messages,
  });
  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  return { text, tokens: res.usage.input_tokens + res.usage.output_tokens };
}

// ── Budget guard (durable, per-user per-day; see lib/usage.ts) ─────────────
async function assertBudget(userId: string): Promise<void> {
  const spent = await usageForDay(userId);
  if (isOverBudget(spent, env.LLM_MAX_TOKENS_PER_USER_DAY)) {
    throw new Error(
      `Daily LLM budget reached for this user (${env.LLM_MAX_TOKENS_PER_USER_DAY} tokens). Try again tomorrow or raise LLM_MAX_TOKENS_PER_USER_DAY.`,
    );
  }
}

export class LLMError extends Error {}

/** Pull a JSON object out of a model response, tolerating ```json fences / prose. */
function parseJsonLoose(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new LLMError("No JSON object found in model response.");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

export type CompleteJSONOptions<T> = {
  /** Identifies the spending user for the budget guard. */
  userId: string;
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  /** Output token cap for this request (clamped to the per-request env limit). */
  maxTokens?: number;
  /** Label for logs. */
  label?: string;
};

/**
 * Run a single-turn completion and return validated JSON of type T.
 * Retries once with a repair instruction if the first response is malformed.
 */
export async function completeJSON<T>(opts: CompleteJSONOptions<T>): Promise<T> {
  const { userId, system, prompt, schema, label = "llm" } = opts;
  await assertBudget(userId);

  const maxTokens = Math.min(
    opts.maxTokens ?? env.LLM_MAX_TOKENS_PER_REQUEST,
    env.LLM_MAX_TOKENS_PER_REQUEST,
  );

  const messages: Msg[] = [{ role: "user", content: prompt }];

  let lastText = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const { text, tokens } = await callProvider(system, messages, maxTokens);
    await recordUsage(userId, tokens);
    console.log(
      `[llm:${label}] provider=${env.LLM_PROVIDER} model=${activeModel()} tokens=${tokens} user=${userId} attempt=${attempt}`,
    );

    lastText = text;
    try {
      const json = parseJsonLoose(lastText);
      return schema.parse(json);
    } catch (err) {
      if (attempt === 1) {
        captureError(err, { at: "llm.completeJSON", label, snippet: lastText.slice(0, 500) });
        throw new LLMError(
          `Model returned invalid JSON after retry: ${(err as Error).message}`,
        );
      }
      messages.push({ role: "assistant", content: lastText });
      messages.push({
        role: "user",
        content:
          "That was not valid JSON matching the required shape. Respond again with ONLY the JSON object, no prose, no code fences.",
      });
    }
  }

  throw new LLMError("Unreachable: completeJSON exhausted attempts.");
}

/** True when the ACTIVE provider has a key — lets callers offer a fallback. */
export function llmConfigured(): boolean {
  return env.LLM_PROVIDER === "openai"
    ? Boolean(env.OPENAI_API_KEY)
    : Boolean(env.ANTHROPIC_API_KEY);
}
