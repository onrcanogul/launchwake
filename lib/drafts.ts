import { z } from "zod";
import { db } from "./db";
import {
  completeJSON,
  llmConfigured,
  wrapUntrusted,
  UNTRUSTED_DATA_NOTICE,
} from "./llm";
import { TONE_GUIDE, type DraftTone } from "./tones";
import { draftLanguageRule, effectiveAudienceCode } from "./audience";
import { isShortformChannel } from "./channels";
import type { Channel, Draft, Project, Ship } from "@prisma/client";

/**
 * Draft generation. Platform-native copy grounded in the channel's rules and the
 * recommendation's ruleNote (the safe way in). The human posts it — we never do.
 *
 * Two shapes come out of here:
 *   • Text channels (Show HN, Reddit, X, …) → a plain draft: `{ body, safetyNote }`.
 *   • Short-form VIDEO channels (TikTok / Reels / Shorts) → a shootable video
 *     concept: a 2-second hook, an ordered shot list, on-screen text, a sound
 *     direction, plus the caption. The caption is stored as `body` (so copy,
 *     ban-safety, tracking and tones keep working unchanged) and the rest as the
 *     `storyboard`. You don't paste a paragraph on TikTok — you shoot a video, so
 *     "just text" is the wrong deliverable there.
 */

export const DraftSchema = z.object({
  body: z.string().min(1).max(3000),
  safetyNote: z.string().max(280).nullish(),
});
export type DraftResult = z.infer<typeof DraftSchema>;

/** One shot in a short-form video concept: a labelled beat + what to record. */
export const ShotBeatSchema = z.object({
  label: z.string().min(1).max(60),
  detail: z.string().min(1).max(240),
});

/** The shootable part of a short-form video concept (persisted as Draft.storyboard). */
export const StoryboardSchema = z.object({
  /** The first ~2 seconds — what's on screen and said, so the scroll stops. */
  hook: z.string().min(1).max(280),
  /** Ordered shot list the founder films/screen-records. */
  beats: z.array(ShotBeatSchema).min(2).max(6),
  /** Caption overlays for mute viewers. */
  onScreenText: z.array(z.string().min(1).max(90)).max(6).default([]),
  /** Audio direction — a TYPE of trending sound, never a named copyrighted track. */
  sound: z.string().min(1).max(200),
});
export type Storyboard = z.infer<typeof StoryboardSchema>;

/** What the LLM returns for a short-form channel: the storyboard + caption + note. */
export const ShotBriefSchema = StoryboardSchema.extend({
  caption: z.string().min(1).max(2200),
  safetyNote: z.string().max(280).nullish(),
});
export type ShotBriefResult = z.infer<typeof ShotBriefSchema>;

/** Read a persisted storyboard (Draft.storyboard Json) back to a typed value. */
export function parseStoryboard(value: unknown): Storyboard | null {
  if (value == null) return null;
  const parsed = StoryboardSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export type DraftContext = {
  project: Pick<Project, "name" | "description" | "url">;
  ship: Pick<Ship, "type" | "title" | "summary">;
  channel: Pick<Channel, "name" | "platform" | "rules" | "tags">;
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

export function buildDraftPrompt(
  ctx: DraftContext,
  tone: DraftTone = "founder",
  audienceCode = "en",
) {
  const style = PLATFORM_STYLE[ctx.channel.platform] ?? PLATFORM_STYLE.OTHER;
  const system = [
    "You write platform-native distribution drafts for a technical founder.",
    "The founder posts it themselves — never write as if auto-posting.",
    "Ground the draft in the channel's rules and the provided ruleNote (the safe way in).",
    "Be specific to the product and the ship. No hype, no emoji spam, no fake metrics.",
    TONE_GUIDE[tone],
    "Write the draft EXACTLY as it should be pasted — do NOT add 'Title:'/'Body:' labels, section headers, or meta commentary.",
    "For Show HN, the very first line must be the title, starting with 'Show HN:'.",
    // Localize the draft to the target audience's language. Empty for English.
    draftLanguageRule(audienceCode),
    UNTRUSTED_DATA_NOTICE,
    "Respond with ONLY a JSON object: {\"body\":string,\"safetyNote\":string}. safetyNote is one line on how to post safely here.",
  ]
    .filter(Boolean)
    .join("\n");

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

/**
 * Where the call-to-action link can live on this platform. YouTube Shorts allows
 * a real clickable link in the description; TikTok and Instagram allow only the
 * profile bio link. The caption CTA must respect this — never paste a raw URL
 * where it can't be tapped.
 */
function ctaLinkNote(platform: string): string {
  return platform === "YOUTUBE"
    ? "link in the description (YouTube Shorts allows a real clickable link there)"
    : "link in bio (this platform allows NO tappable link in the caption)";
}

/** Prompt for a short-form VIDEO concept — a shootable storyboard, not a paragraph. */
export function buildShotBriefPrompt(
  ctx: DraftContext,
  tone: DraftTone = "founder",
  audienceCode = "en",
) {
  const linkNote = ctaLinkNote(ctx.channel.platform);
  const system = [
    "You design short-form vertical VIDEO concepts (TikTok / Instagram Reels / YouTube Shorts) for a technical founder who will film and post it themselves — never write as if auto-posting.",
    "Output a concrete, shootable concept the founder can record on their phone or screen today — NOT a text post. It has: a 2-second hook, an ordered shot list, on-screen text overlays, an audio direction, and the caption to paste.",
    "Hook: the first ~2 seconds must open on the payoff or the problem — never a slow logo/title intro — or the viewer scrolls past.",
    "Shot list: 3–5 beats, each a concrete thing to film or screen-record (native phone/screen footage beats exported marketing renders).",
    "onScreenText: a few short caption overlays for mute scrollers.",
    "sound: describe the TYPE of trending audio to use (e.g. 'an upbeat trending sound'); never name a specific copyrighted track.",
    `caption: the text to paste, ending with a CTA — ${linkNote}. Do NOT paste a raw URL where it can't be tapped.`,
    "Be specific to the product and this ship. No hype, no emoji spam, no fake metrics.",
    TONE_GUIDE[tone],
    // Localize generated content to the target audience's language. Empty for English.
    draftLanguageRule(audienceCode),
    UNTRUSTED_DATA_NOTICE,
    'Respond with ONLY a JSON object: {"hook":string,"beats":[{"label":string,"detail":string}],"onScreenText":[string],"sound":string,"caption":string,"safetyNote":string}. safetyNote is one line on how to post safely here.',
  ]
    .filter(Boolean)
    .join("\n");

  const prompt = [
    `Channel: ${ctx.channel.name} [${ctx.channel.platform}] — short-form vertical video`,
    ctx.channel.rules ? `Format rules: ${ctx.channel.rules}` : "",
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
    "Design the video concept now.",
  ]
    .filter(Boolean)
    .join("\n");

  return { system, prompt };
}

/** Offline short-form video concept so it works without an API key. */
export function heuristicShotBrief(ctx: DraftContext): ShotBriefResult {
  const { project, ship } = ctx;
  const cta =
    ctx.channel.platform === "YOUTUBE"
      ? "Link in the description."
      : "Link in bio.";
  const what = ship.title.toLowerCase();
  return {
    hook: `Open on ${project.name} doing ${what} — show the result in the first 2 seconds, no logo intro.`,
    beats: [
      {
        label: "Hook",
        detail: `The single most satisfying moment of ${ship.title}, full-screen. No intro card.`,
      },
      {
        label: "Problem",
        detail: ship.summary ?? `Show the pain ${project.name} takes away — the before.`,
      },
      {
        label: "Demo",
        detail: `Screen-record ${project.name} doing it end-to-end. Tight cuts, big captions.`,
      },
      {
        label: "Payoff + CTA",
        detail: `Land on the result. ${cta}`,
      },
    ],
    onScreenText: [ship.title, `Built with ${project.name}`],
    sound: "An upbeat trending sound that fits the vibe — swap for whatever is trending today.",
    caption: `${ship.summary ?? ship.title} — built into ${project.name}. ${cta}`,
    safetyNote:
      ctx.ruleNote ??
      "Post from your own account; native phone/screen footage outperforms exported renders.",
  };
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

  // Localize the draft to the ship's effective audience (ship override, else the
  // project default) — the same resolution the plan uses, so a plan and its
  // drafts always come out in one language.
  const audienceCode = effectiveAudienceCode(
    ship.audienceLanguage,
    project.audienceLanguage,
  );

  // Short-form video channels get a shootable concept, not a paragraph. The
  // caption becomes `body`; the storyboard (hook/shots/text/sound) is stored
  // alongside it so the kit can render the shoot plan.
  if (isShortformChannel(rec.channel)) {
    const prompt = buildShotBriefPrompt(ctx, tone, audienceCode);
    const brief = llmConfigured()
      ? await completeJSON({
          userId: project.userId,
          system: prompt.system,
          prompt: prompt.prompt,
          schema: ShotBriefSchema,
          label: `brief:${rec.channel.platform}:${tone}:${audienceCode}`,
        })
      : heuristicShotBrief(ctx);

    const { caption, safetyNote, ...storyboard } = brief;
    return db.draft.upsert({
      where: { recommendationId },
      update: {
        platform: rec.channel.platform,
        body: caption,
        safetyNote: safetyNote ?? ctx.ruleNote,
        storyboard,
      },
      create: {
        recommendationId,
        platform: rec.channel.platform,
        body: caption,
        safetyNote: safetyNote ?? ctx.ruleNote,
        storyboard,
      },
    });
  }

  const prompt = buildDraftPrompt(ctx, tone, audienceCode);
  const result = llmConfigured()
    ? await completeJSON({
        userId: project.userId,
        system: prompt.system,
        prompt: prompt.prompt,
        schema: DraftSchema,
        label: `draft:${rec.channel.platform}:${tone}:${audienceCode}`,
      })
    : heuristicDraft(ctx);

  return db.draft.upsert({
    where: { recommendationId },
    update: {
      platform: rec.channel.platform,
      body: result.body,
      safetyNote: result.safetyNote ?? ctx.ruleNote,
    },
    create: {
      recommendationId,
      platform: rec.channel.platform,
      body: result.body,
      safetyNote: result.safetyNote ?? ctx.ruleNote,
    },
  });
}
