import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { env, requireEnv } from "./env";

/**
 * Anthropic wrapper. All LLM calls go through here so we get: one client, strict
 * JSON output validated by zod (with a single repair retry), token logging, and a
 * cheap two-level budget guard (per request + per user per day).
 */

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: requireEnv("ANTHROPIC_API_KEY", "LLM analysis") });
  }
  return client;
}

// ── Budget guard (in-memory; cheap MVP guard, resets on deploy) ────────────
type DayBucket = { day: string; tokens: number };
const usageByUser = new Map<string, DayBucket>();

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function usageFor(userId: string): number {
  const b = usageByUser.get(userId);
  return b && b.day === today() ? b.tokens : 0;
}

function assertBudget(userId: string) {
  if (usageFor(userId) >= env.LLM_MAX_TOKENS_PER_USER_DAY) {
    throw new Error(
      `Daily LLM budget reached for this user (${env.LLM_MAX_TOKENS_PER_USER_DAY} tokens). Try again tomorrow or raise LLM_MAX_TOKENS_PER_USER_DAY.`,
    );
  }
}

function recordUsage(userId: string, tokens: number) {
  const day = today();
  const b = usageByUser.get(userId);
  if (b && b.day === day) b.tokens += tokens;
  else usageByUser.set(userId, { day, tokens });
}

export class LLMError extends Error {}

function extractText(msg: Anthropic.Message): string {
  return msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

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
  assertBudget(userId);

  const maxTokens = Math.min(
    opts.maxTokens ?? env.LLM_MAX_TOKENS_PER_REQUEST,
    env.LLM_MAX_TOKENS_PER_REQUEST,
  );

  const messages: Anthropic.MessageParam[] = [{ role: "user", content: prompt }];

  let lastText = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const msg = await getClient().messages.create({
      model: env.ANTHROPIC_MODEL,
      max_tokens: maxTokens,
      system,
      messages,
    });

    const used = msg.usage.input_tokens + msg.usage.output_tokens;
    recordUsage(userId, used);
    console.log(
      `[llm:${label}] model=${env.ANTHROPIC_MODEL} in=${msg.usage.input_tokens} out=${msg.usage.output_tokens} user=${userId} attempt=${attempt}`,
    );

    lastText = extractText(msg);
    try {
      const json = parseJsonLoose(lastText);
      return schema.parse(json);
    } catch (err) {
      if (attempt === 1) {
        throw new LLMError(
          `Model returned invalid JSON after retry: ${(err as Error).message}`,
        );
      }
      // Feed the bad output back and ask for a strict repair.
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

/** True when an API key is configured — lets callers offer a graceful fallback. */
export function llmConfigured(): boolean {
  return Boolean(env.ANTHROPIC_API_KEY);
}
