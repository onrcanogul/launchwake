import { createHash } from "crypto";
import { z } from "zod";
import {
  completeJSON,
  llmConfigured,
  wrapUntrusted,
  UNTRUSTED_DATA_NOTICE,
} from "./llm";
import { captureError } from "./observability";

/**
 * Product classification — the LLM's read of WHAT a product is, so the analysis
 * itself (not a keyword heuristic alone) decides when short-form video channels
 * (TikTok / Reels / Shorts) belong in a plan.
 *
 * Golden rule intact: this NEVER invents channels. It only produces fit-tags that
 * gate which catalog channels enter `matchChannels`' candidate set — the LLM still
 * ranks only channels we hand it. See `classificationToTags` for the tag mapping
 * and `lib/channels.ts` (`shortformEligible`) for the gate it feeds.
 *
 * Cost discipline: one small, cheap call, budget-guarded (`completeJSON`), cached
 * on `Project` and re-run only when name/description/url change — so repeat plan
 * builds pay nothing. On ANY failure (or when the LLM is unconfigured) the caller
 * falls back to the pure `deriveSignalTags` heuristic.
 */

// ── Output contract ────────────────────────────────────────
export const ProductClassificationSchema = z.object({
  /** Who the product is for. Drives consumer/b2c tagging. */
  audience: z.enum(["b2b", "b2c", "both"]),
  /** What kind of thing it is. Drives mobile-app / game / desktop tagging. */
  form: z.enum(["web", "mobile", "desktop", "cli", "library", "game"]),
  /** True when the product is genuinely demonstrable in a short screen-recording. */
  visualDemo: z.boolean(),
  /**
   * How sure the model is. LOW is the conservative default: it produces NO
   * consumer/visual tags, so an ambiguous product (a "mobile SDK", a "video API")
   * is never handed TikTok. Only HIGH admits short-form.
   */
  confidence: z.enum(["high", "low"]),
  /** One-sentence justification, rendered into the ranking prompt's why-line context. */
  reason: z.string().min(1).max(400),
});
export type ProductClassification = z.infer<typeof ProductClassificationSchema>;

export type ClassifyInput = {
  name: string;
  description?: string | null;
  url?: string | null;
  shipTitle?: string | null;
  shipSummary?: string | null;
};

/** Output-token cap for the classification call — a tiny JSON object, so small. */
const CLASSIFY_MAX_TOKENS = 300;

/**
 * Cache key for the classification: sha256 of the PRODUCT inputs only
 * (name + description + url). Ship title/summary enrich the one-time call but are
 * deliberately excluded here — a product's nature ("a b2c mobile game") is stable
 * across ships, so re-classifying per ship would waste tokens. Re-classify only
 * when the product itself is edited.
 */
export function classificationInputHash(p: {
  name: string;
  description?: string | null;
  url?: string | null;
}): string {
  return createHash("sha256")
    .update(`${p.name}\n${p.description ?? ""}\n${p.url ?? ""}`)
    .digest("hex");
}

/**
 * Map a classification to catalog fit-tags, merged into `matchChannels`' signal
 * set. Pure + tested.
 *
 * Conservative by construction: a LOW-confidence classification yields NO tags at
 * all, so the short-form gate stays closed and a devtool never gets TikTok. Only a
 * HIGH-confidence, genuinely consumer/visual product produces the tags
 * (`consumer`, `b2c`, `mobile-app`, `game`, `visual-demo`) that `shortformEligible`
 * checks. `desktop` is emitted for completeness but is not a short-form gate tag.
 */
export function classificationToTags(c: ProductClassification): string[] {
  if (c.confidence === "low") return [];

  const tags = new Set<string>();

  if (c.audience === "b2c" || c.audience === "both") {
    tags.add("consumer");
    tags.add("b2c");
  }

  switch (c.form) {
    case "mobile":
      tags.add("mobile-app");
      tags.add("mobile");
      break;
    case "game":
      // A game is inherently consumer + visual, regardless of stated audience.
      tags.add("game");
      tags.add("consumer");
      break;
    case "desktop":
      tags.add("desktop");
      break;
    // web / cli / library carry no form-specific consumer/visual tag; a web app
    // only becomes short-form-eligible via audience (b2c) or visualDemo below.
  }

  if (c.visualDemo) tags.add("visual-demo");

  return [...tags];
}

/**
 * Prompt for the classification call. Pure → unit-testable without a network hit.
 * Every user-controlled field is wrapped in the untrusted-data delimiter, and the
 * system prompt biases hard toward the conservative call (b2b / not-visual / low
 * confidence) unless the product is clearly consumer and visual.
 */
export function buildClassifyPrompt(input: ClassifyInput): {
  system: string;
  prompt: string;
} {
  const system = [
    "You are LaunchWake's product classifier. Given a technical product, decide WHAT it is so downstream logic can pick distribution channels.",
    "Return ONLY a JSON object, no prose, no code fences.",
    "",
    "Fields:",
    '- audience: "b2b" (developers/companies/teams), "b2c" (everyday consumers), or "both".',
    '- form: "web" | "mobile" | "desktop" | "cli" | "library" | "game" — the PRIMARY way people use it.',
    "- visualDemo: true ONLY if the product is genuinely compelling in a short (5–15s) screen recording — a phone app, a game, a design/photo/video tool. A CLI, an API, a backend library, or a config-driven B2B tool is NOT visualDemo, even if it has a dashboard.",
    '- confidence: "high" only when the audience and form are clear from the text; "low" when the product is ambiguous (e.g. "mobile SDK", "video API", a bare name with no description).',
    "- reason: one sentence, product-specific, explaining the call — this is shown to the strategist that writes channel recommendations.",
    "",
    "Bias CONSERVATIVE. When unsure whether a product is consumer/visual, choose audience b2b, visualDemo false, confidence low. It is far worse to mislabel a developer tool as consumer (it would get recommended TikTok) than to under-call a genuine consumer app.",
    "",
    UNTRUSTED_DATA_NOTICE,
    "",
    'JSON shape: {"audience":"b2b|b2c|both","form":"web|mobile|desktop|cli|library|game","visualDemo":boolean,"confidence":"high|low","reason":string}',
  ].join("\n");

  const prompt = [
    `Product name: ${wrapUntrusted("product_name", input.name)}`,
    input.description
      ? `Description: ${wrapUntrusted("product_description", input.description)}`
      : "Description: (none provided)",
    input.url ? `URL: ${wrapUntrusted("product_url", input.url)}` : "",
    input.shipTitle
      ? `Latest ship title: ${wrapUntrusted("ship_title", input.shipTitle)}`
      : "",
    input.shipSummary
      ? `Latest ship summary: ${wrapUntrusted("ship_summary", input.shipSummary)}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  return { system, prompt };
}

/**
 * Classify a product via one small LLM call. Returns null when the LLM is
 * unconfigured or the call fails for any reason (budget exhausted, provider error,
 * invalid JSON after repair) — the caller then falls back to the pure heuristic.
 * Never throws.
 */
export async function classifyProduct(
  input: ClassifyInput,
  userId: string,
): Promise<ProductClassification | null> {
  if (!llmConfigured()) return null;

  const { system, prompt } = buildClassifyPrompt(input);
  try {
    return await completeJSON({
      userId,
      system,
      prompt,
      schema: ProductClassificationSchema,
      maxTokens: CLASSIFY_MAX_TOKENS,
      label: "classify",
    });
  } catch (err) {
    // Non-fatal: the plan build continues on the heuristic tag path. Capture so a
    // misconfigured key or a persistent parse failure is still visible in Sentry.
    captureError(err, {
      at: "classify.classifyProduct",
      reason: "classification_fallback",
    });
    console.warn(
      `[classify] classification failed — falling back to heuristic tags: ${(err as Error).message}`,
    );
    return null;
  }
}
