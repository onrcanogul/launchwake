import { z } from "zod";
import { db } from "./db";
import {
  completeJSON,
  llmConfigured,
  wrapUntrusted,
  UNTRUSTED_DATA_NOTICE,
} from "./llm";
import { checkDraft, safetyVerdict, type SafetyReport } from "./bansafety";
import { TONE_GUIDE, type DraftTone } from "./tones";
import type { Channel, Draft, Project, Ship } from "@prisma/client";

/**
 * Draft generation. Platform-native copy grounded in the channel's rules and the
 * recommendation's ruleNote (the safe way in). The human posts it — we never do.
 */

/**
 * Per-channel body ceilings. A draft that overruns the platform's real limit is
 * useless (a truncated X thread, a rejected Mastodon post), so we cap the LLM at
 * the schema level per platform instead of a single generous 3000.
 */
const PLATFORM_MAX_LEN: Record<string, number> = {
  HACKERNEWS: 2000,
  REDDIT: 3000,
  X: 1000, // a short numbered thread, not one 3000-char wall
  LINKEDIN: 2900, // LinkedIn's post limit is ~3000
  PRODUCTHUNT: 700, // tagline + a short maker comment
  INDIEHACKERS: 3000,
  DEVTO: 3000,
  LOBSTERS: 2000,
  MASTODON: 500,
  BLUESKY: 300,
  DISCORD: 2000,
  SLACK: 2000,
};
const DEFAULT_MAX_LEN = 3000;

/** The body character cap for a platform. */
export function platformMaxLen(platform: string): number {
  return PLATFORM_MAX_LEN[platform] ?? DEFAULT_MAX_LEN;
}

/** Draft schema tightened to a platform's real length limit. */
export function draftSchemaFor(platform: string) {
  return z.object({
    body: z.string().min(1).max(platformMaxLen(platform)),
    safetyNote: z.string().max(280).nullish(),
  });
}

/** Default (widest) draft schema — kept for callers that aren't channel-scoped. */
export const DraftSchema = draftSchemaFor("OTHER");
export type DraftResult = z.infer<typeof DraftSchema>;

export type DraftContext = {
  project: Pick<Project, "name" | "description" | "url">;
  ship: Pick<Ship, "type" | "title" | "summary">;
  channel: Pick<Channel, "name" | "platform" | "rules">;
  ruleNote: string | null;
};

const PLATFORM_STYLE: Record<string, string> = {
  HACKERNEWS:
    "Show HN format. Title line 'Show HN: <what it is>'. Lead with the problem you hit and the build story. No marketing adjectives. End with a genuine question to invite discussion.",
  REDDIT:
    "Value-first per the 90/10 rule. Do NOT put a link in the title. Teach something useful; mention the tool only as context near the end.",
  X: "Short thread. Hook in the very first line. Link last (or note it goes in a reply). Number the tweets 1/, 2/, 3/.",
  LINKEDIN:
    "Professional founder voice. Lead with a relatable pain. Put the link in the first comment, not the post body (LinkedIn throttles outbound links).",
  PRODUCTHUNT:
    "A punchy one-line tagline plus a short maker's first comment explaining why you built it.",
  INDIEHACKERS:
    "Warm, transparent founder tone. Share the what, the why, and a concrete number if you have one.",
  DEVTO:
    "Opening of a technical article/tutorial: a hook, what the reader will learn, and where the product fits naturally.",
  LOBSTERS:
    "Purely technical framing, no marketing. Disclose authorship. Only substance.",
  OTHER: "Match the community's norms; value-first, honest, concise.",
};

export function buildDraftPrompt(ctx: DraftContext, tone: DraftTone = "founder") {
  const style = PLATFORM_STYLE[ctx.channel.platform] ?? PLATFORM_STYLE.OTHER;
  const system = [
    "You write platform-native distribution drafts for a technical founder.",
    "The founder posts it themselves — never write as if auto-posting.",
    "Ground the draft in the channel's rules and the provided ruleNote (the safe way in).",
    "Be specific to the product and the ship. No hype, no emoji spam, no fake metrics.",
    TONE_GUIDE[tone],
    "Write the draft EXACTLY as it should be pasted — do NOT add 'Title:'/'Body:' labels, section headers, or meta commentary.",
    "For Show HN, the very first line must be the title, starting with 'Show HN:'.",
    UNTRUSTED_DATA_NOTICE,
    "Respond with ONLY a JSON object: {\"body\":string,\"safetyNote\":string}. safetyNote is one line on how to post safely here.",
  ].join("\n");

  const prompt = [
    `Channel: ${ctx.channel.name} [${ctx.channel.platform}]`,
    `Channel style: ${style}`,
    ctx.channel.rules ? `Channel rules: ${ctx.channel.rules}` : "",
    ctx.ruleNote ? `Safe way in for this post: ${ctx.ruleNote}` : "",
    "",
    `Product: ${wrapUntrusted("product_name", ctx.project.name)}`,
    ctx.project.url ? `Product URL: ${wrapUntrusted("product_url", ctx.project.url)}` : "",
    ctx.project.description
      ? `About: ${wrapUntrusted("product_description", ctx.project.description)}`
      : "",
    "",
    `Ship type: ${ctx.ship.type}`,
    `Ship: ${wrapUntrusted("ship_title", ctx.ship.title)}`,
    ctx.ship.summary ? `Why it matters: ${wrapUntrusted("ship_summary", ctx.ship.summary)}` : "",
    "",
    "Write the draft now.",
  ]
    .filter(Boolean)
    .join("\n");

  return { system, prompt };
}

/** Offline template so drafts work without an API key. */
export function heuristicDraft(ctx: DraftContext): DraftResult {
  const { project, ship, channel } = ctx;
  const url = project.url ?? "";
  const safety = ctx.ruleNote ?? firstSentence(channel.rules) ?? "Post from your own account, engage genuinely.";

  let body: string;
  switch (channel.platform) {
    case "HACKERNEWS":
      body = `Show HN: ${project.name} — ${ship.title}\n\n${ship.summary ?? `We just shipped ${ship.title}.`}\n\nCurious how others handle this today. Feedback welcome.`;
      break;
    case "X":
      body = `1/ ${ship.summary ?? ship.title}\n\n${project.name} just shipped: ${ship.title}. 🧵\n\n2/ Here's why it matters and how it works.\n\n3/ Try it → ${url}`;
      break;
    case "REDDIT":
      body = `How do you currently handle ${ship.title.toLowerCase()}?\n\nSharing my approach: ${ship.summary ?? ship.title}. Built it into a small tool I maintain (${project.name}) — happy to share, but the pattern works with anything.`;
      break;
    case "LINKEDIN":
      body = `${ship.summary ?? ship.title}\n\n${project.name} now does exactly this. If this is a pain for your team, I'd love your feedback. Link in the comments.`;
      break;
    default:
      body = `${ship.title}\n\n${ship.summary ?? `A new update to ${project.name}.`}\n\n${url}`;
  }

  return { body, safetyNote: safety };
}

function firstSentence(text?: string | null): string | undefined {
  if (!text) return undefined;
  const m = text.match(/^(.*?[.!?])(\s|$)/);
  return (m ? m[1] : text).slice(0, 200);
}

export type FinalizedDraft = {
  body: string;
  safetyNote: string | null;
  report: SafetyReport;
};

/**
 * Enforce the guardrails before a draft is returned/persisted: clamp the body to
 * the platform's length limit, then run the deterministic ban-safety linter. When
 * a check would get the post removed (a hard fail), the safetyNote leads with the
 * fix so the founder can't miss it. Pure → unit-tested.
 */
export function enforceDraft(input: {
  body: string;
  safetyNote?: string | null;
  platform: string;
  channelRules?: string | null;
  ruleNote?: string | null;
}): FinalizedDraft {
  const max = platformMaxLen(input.platform);
  const body =
    input.body.length > max ? input.body.slice(0, max).trimEnd() : input.body;

  const report = checkDraft({
    body,
    platform: input.platform,
    channelRules: input.channelRules ?? null,
  });

  const firstFail = report.checks.find((c) => c.level === "fail");
  const safetyNote = firstFail
    ? `${safetyVerdict(report)} — ${firstFail.detail}`
    : (input.safetyNote ?? input.ruleNote ?? safetyVerdict(report));

  return { body, safetyNote, report };
}

/** Generate (and persist) a draft for a recommendation. Idempotent per rec. */
export async function generateDraft(
  recommendationId: string,
  tone: DraftTone = "founder",
): Promise<Draft> {
  const rec = await db.recommendation.findUnique({
    where: { id: recommendationId },
    include: {
      channel: true,
      plan: { include: { ship: { include: { project: true } } } },
    },
  });
  if (!rec) throw new Error(`Recommendation ${recommendationId} not found`);

  const ship = rec.plan.ship;
  const project = ship.project;

  const ctx: DraftContext = {
    project,
    ship,
    channel: rec.channel,
    ruleNote: rec.ruleNote,
  };

  const prompt = buildDraftPrompt(ctx, tone);
  const result = llmConfigured()
    ? await completeJSON({
        userId: project.userId,
        system: prompt.system,
        prompt: prompt.prompt,
        // Per-channel length ceiling: the model is constrained (and retried) to
        // the platform's real limit instead of a generic 3000.
        schema: draftSchemaFor(rec.channel.platform),
        label: `draft:${rec.channel.platform}:${tone}`,
      })
    : heuristicDraft(ctx);

  // Clamp to length + run the ban-safety linter before persisting, so a draft
  // that would get removed carries the fix in its safetyNote.
  const finalized = enforceDraft({
    body: result.body,
    safetyNote: result.safetyNote,
    platform: rec.channel.platform,
    channelRules: rec.channel.rules,
    ruleNote: rec.ruleNote,
  });

  return db.draft.upsert({
    where: { recommendationId },
    update: {
      platform: rec.channel.platform,
      body: finalized.body,
      safetyNote: finalized.safetyNote,
    },
    create: {
      recommendationId,
      platform: rec.channel.platform,
      body: finalized.body,
      safetyNote: finalized.safetyNote,
    },
  });
}
