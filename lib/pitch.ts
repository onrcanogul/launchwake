import { z } from "zod";
import { db } from "./db";
import {
  completeJSON,
  llmConfigured,
  wrapUntrusted,
  UNTRUSTED_DATA_NOTICE,
} from "./llm";
import { matchChannels } from "./channels";
import { getProjectTagContext } from "./projectTags";
import type { Channel, PitchStatus, Project, Ship } from "@prisma/client";

/**
 * Newsletter Pitch Engine.
 *
 * You don't "post" to a newsletter — you pitch its curator. Newsletters are the
 * highest-leverage channel for devtools, but writing the pitch is the job
 * everyone puts off. This generates a concise, personalized pitch email grounded
 * in the specific newsletter's audience and selection criteria, tracks the send,
 * and nudges a follow-up if there's no reply. The founder sends the email — we
 * never do.
 *
 * Pure prompt/format builders are unit-tested; the LLM call is budget-guarded
 * with an offline heuristic fallback.
 */

export const FOLLOW_UP_DAYS = 5;
// How many newsletter opportunities to surface per ship.
const MAX_NEWSLETTERS = 6;

const PitchSchema = z.object({
  subject: z.string().min(1).max(160),
  body: z.string().min(1).max(2500),
});
export type PitchResult = z.infer<typeof PitchSchema>;

export type PitchContext = {
  project: Pick<Project, "name" | "description" | "url">;
  ship: Pick<Ship, "type" | "title" | "summary">;
  channel: Pick<Channel, "name" | "audienceDesc" | "rules" | "url">;
};

/** System + user prompt for a curator pitch. Pure → unit-testable. */
export function buildPitchPrompt(ctx: PitchContext) {
  const system = [
    "You write a short, personalized pitch email from a technical founder to the curator of a developer/startup newsletter.",
    "The founder will review and SEND it themselves — write in their first-person voice, ready to paste.",
    "Rules that make it land instead of getting ignored:",
    "- Open with one specific reason this fits THIS newsletter's readers (use its audience + selection criteria).",
    "- Lead with what's genuinely interesting or useful, not marketing. Respect the newsletter's stated criteria.",
    "- One clear link. Keep it under ~130 words. No attachments, no hype, no fake urgency.",
    "- If the newsletter is editorial-only (no submission form), pitch why it's newsworthy rather than asking to be added.",
    "- Sound like a human who actually reads the newsletter, not a mass blast.",
    UNTRUSTED_DATA_NOTICE,
    'Respond with ONLY a JSON object: {"subject":string,"body":string}. Subject is a tight, specific email subject line.',
  ].join("\n");

  const prompt = [
    `Newsletter: ${ctx.channel.name}`,
    ctx.channel.audienceDesc ? `Audience: ${ctx.channel.audienceDesc}` : "",
    ctx.channel.rules ? `How they select / submit: ${ctx.channel.rules}` : "",
    "",
    `Product: ${wrapUntrusted("product_name", ctx.project.name)}`,
    ctx.project.url ? `Product URL: ${wrapUntrusted("product_url", ctx.project.url)}` : "",
    ctx.project.description
      ? `What it does: ${wrapUntrusted("product_description", ctx.project.description)}`
      : "",
    "",
    `The news to pitch (${ctx.ship.type}): ${wrapUntrusted("ship_title", ctx.ship.title)}`,
    ctx.ship.summary ? `Why it matters: ${wrapUntrusted("ship_summary", ctx.ship.summary)}` : "",
    "",
    "Write the pitch email now.",
  ]
    .filter(Boolean)
    .join("\n");

  return { system, prompt };
}

/** Offline template so pitches work without an API key. Pure. */
export function heuristicPitch(ctx: PitchContext): PitchResult {
  const { project, ship, channel } = ctx;
  const subject = `${project.name}: ${ship.title}`;
  const body = [
    `Hi — I'm the maker of ${project.name}${project.url ? ` (${project.url})` : ""}.`,
    "",
    `${project.description ? `${project.description} ` : ""}We just shipped ${ship.title}${ship.summary ? ` — ${lowerFirst(ship.summary)}` : ""}.`,
    "",
    `I read ${channel.name} and think it's a genuine fit for your readers${channel.audienceDesc ? ` (${channel.audienceDesc})` : ""}. Happy to share more detail, a demo, or an exclusive angle if useful.`,
    "",
    "Thanks for considering it.",
  ].join("\n");
  return { subject, body };
}

function lowerFirst(s: string): string {
  return s ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

/** Generate (and persist) a pitch for a (ship, newsletter). Keeps existing status. */
export async function generatePitch(shipId: string, channelId: string): Promise<PitchResult> {
  const ship = await db.ship.findUnique({
    where: { id: shipId },
    include: { project: true },
  });
  if (!ship) throw new Error(`Ship ${shipId} not found`);
  const channel = await db.channel.findUnique({ where: { id: channelId } });
  if (!channel) throw new Error(`Channel ${channelId} not found`);
  if (channel.platform !== "NEWSLETTER") throw new Error("Pitches are for newsletters only.");

  const ctx: PitchContext = { project: ship.project, ship, channel };
  const prompt = buildPitchPrompt(ctx);
  const result = llmConfigured()
    ? await completeJSON({
        userId: ship.project.userId,
        system: prompt.system,
        prompt: prompt.prompt,
        schema: PitchSchema,
        label: `pitch:${channel.slug}`,
        maxTokens: 900,
      })
    : heuristicPitch(ctx);

  await db.newsletterPitch.upsert({
    where: { shipId_channelId: { shipId, channelId } },
    update: { subject: result.subject, body: result.body },
    create: { shipId, channelId, subject: result.subject, body: result.body },
  });
  return result;
}

// ── Read model ─────────────────────────────────────────────
export type PitchView = {
  id: string;
  subject: string;
  body: string;
  status: PitchStatus;
  sentAt: Date | null;
  followUpAt: Date | null;
};

export type NewsletterOpportunity = {
  channelId: string;
  channelName: string;
  channelSlug: string;
  audienceDesc: string | null;
  url: string | null;
  rules: string | null;
  pitch: PitchView | null;
};

/**
 * The newsletter opportunities for a ship: the best-fit newsletters from the
 * catalog, each with its pitch (if one has been generated). Existing pitches for
 * off-list newsletters are appended so nothing is lost.
 */
export async function getShipPitches(shipId: string): Promise<NewsletterOpportunity[]> {
  const ship = await db.ship.findUnique({ where: { id: shipId }, include: { project: true } });
  if (!ship) return [];

  const catalog = await db.channel.findMany({ where: { platform: "NEWSLETTER" } });
  // Shared fit-context (keyword signals over product + ship text).
  const { ctx } = await getProjectTagContext(ship.project, { ship });
  const ranked = matchChannels(catalog, ctx, MAX_NEWSLETTERS);

  const pitches = await db.newsletterPitch.findMany({ where: { shipId } });
  const pitchByChannel = new Map(pitches.map((p) => [p.channelId, p]));

  const chosen = new Map<string, (typeof catalog)[number]>();
  for (const r of ranked) chosen.set(r.channel.id, r.channel);
  // Keep any newsletter that already has a pitch even if it fell off the ranking.
  for (const p of pitches) {
    if (!chosen.has(p.channelId)) {
      const c = catalog.find((ch) => ch.id === p.channelId);
      if (c) chosen.set(c.id, c);
    }
  }

  return [...chosen.values()].map((c) => {
    const p = pitchByChannel.get(c.id);
    return {
      channelId: c.id,
      channelName: c.name,
      channelSlug: c.slug,
      audienceDesc: c.audienceDesc,
      url: c.url,
      rules: c.rules,
      pitch: p
        ? { id: p.id, subject: p.subject, body: p.body, status: p.status, sentAt: p.sentAt, followUpAt: p.followUpAt }
        : null,
    };
  });
}

// ── Status mutations (owner-scoped) ────────────────────────
async function assertPitchOwned(pitchId: string, accountId: string): Promise<void> {
  const p = await db.newsletterPitch.findFirst({
    where: { id: pitchId, ship: { project: { userId: accountId } } },
    select: { id: true },
  });
  if (!p) throw new Error("Pitch not found.");
}

export async function setPitchStatus(
  pitchId: string,
  accountId: string,
  status: PitchStatus,
  now: Date = new Date(),
): Promise<void> {
  await assertPitchOwned(pitchId, accountId);
  const data =
    status === "SENT"
      ? { status, sentAt: now, followUpAt: new Date(now.getTime() + FOLLOW_UP_DAYS * 86_400_000) }
      : status === "DRAFT"
        ? { status, sentAt: null, followUpAt: null }
        : { status, followUpAt: null }; // REPLIED / DECLINED — stop nudging
  await db.newsletterPitch.update({ where: { id: pitchId }, data });
}

// ── Digest: pitches awaiting follow-up ─────────────────────
export type FollowUpPitch = { channelName: string; shipTitle: string; sentAt: Date };

/** Sent pitches whose follow-up window has passed with no reply. For the digest. */
export async function pitchesToFollowUp(
  accountId: string,
  now: Date = new Date(),
  limit = 3,
): Promise<FollowUpPitch[]> {
  const rows = await db.newsletterPitch.findMany({
    where: {
      status: "SENT",
      followUpAt: { lte: now },
      ship: { project: { userId: accountId } },
    },
    include: { channel: { select: { name: true } }, ship: { select: { title: true } } },
    orderBy: { followUpAt: "asc" },
    take: limit,
  });
  return rows.map((r) => ({ channelName: r.channel.name, shipTitle: r.ship.title, sentAt: r.sentAt! }));
}
