import { randomBytes } from "crypto";
import { db } from "./db";
import { env } from "./env";
import type { Platform } from "@prisma/client";

/**
 * Attribution: tracked links + click/signup ingest + per-channel rollups.
 *
 * Flow: user marks a channel as "posted" → we mint a TrackedLink (/r/{code}) →
 * they put that link in their post → clicks hit /r/{code} (CLICK event, redirect
 * to the product with UTM + lw_ref) → the product's thank-you page pings
 * /api/track/signup with lw_ref (SIGNUP event). Results reads the rollup.
 */

// ── Pure helpers (unit-testable) ───────────────────────────

const ALPHABET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/** URL-safe short code, base62. */
export function generateShortCode(len = 7): string {
  const bytes = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export function platformSource(platform: Platform | string): string {
  return String(platform).toLowerCase();
}

export function slugifyCampaign(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/** Append UTM params + lw_ref to the product URL for a given channel/ship. */
export function buildDestUrl(
  productUrl: string,
  platform: Platform | string,
  shipTitle: string,
): string {
  const u = new URL(productUrl);
  u.searchParams.set("utm_source", platformSource(platform));
  u.searchParams.set("utm_medium", "launchwake");
  u.searchParams.set("utm_campaign", slugifyCampaign(shipTitle));
  return u.toString();
}

/** The public tracked link a user pastes into their post. */
export function trackedUrl(shortCode: string): string {
  return `${env.APP_URL.replace(/\/$/, "")}/r/${shortCode}`;
}

// ── Write side ─────────────────────────────────────────────

export type RecordedPost = {
  postId: string;
  shortCode: string;
  trackedUrl: string;
  destUrl: string;
};

/**
 * Mark a recommendation's channel as posted: create the Post + a TrackedLink
 * pointing at the product URL with UTM. Idempotent per (ship, channel) — returns
 * the existing tracked link if already recorded.
 */
export async function recordPostForRecommendation(
  recommendationId: string,
  postedUrl?: string,
): Promise<RecordedPost> {
  const rec = await db.recommendation.findUnique({
    where: { id: recommendationId },
    include: {
      channel: true,
      plan: { include: { ship: { include: { project: true } } } },
    },
  });
  if (!rec) throw new Error("Recommendation not found");

  const ship = rec.plan.ship;
  const project = ship.project;
  if (!project.url) {
    throw new Error(
      "Add a product URL in Settings before tracking — that's where clicks are sent.",
    );
  }

  const existing = await db.post.findFirst({
    where: { shipId: ship.id, channelId: rec.channelId },
    include: { trackedLink: true },
  });
  if (existing?.trackedLink) {
    return {
      postId: existing.id,
      shortCode: existing.trackedLink.shortCode,
      trackedUrl: trackedUrl(existing.trackedLink.shortCode),
      destUrl: existing.trackedLink.destUrl,
    };
  }

  const destUrl = buildDestUrl(project.url, rec.channel.platform, ship.title);

  // Create the post (reuse an existing post for this channel if present).
  const post =
    existing ??
    (await db.post.create({
      data: {
        shipId: ship.id,
        channelId: rec.channelId,
        url: postedUrl || null,
      },
    }));

  // Mint a unique short code (retry on the rare collision).
  let shortCode = generateShortCode();
  for (let i = 0; i < 5; i++) {
    const clash = await db.trackedLink.findUnique({ where: { shortCode } });
    if (!clash) break;
    shortCode = generateShortCode();
  }

  await db.trackedLink.create({
    data: { postId: post.id, shortCode, destUrl },
  });

  // Advance ship status to POSTED.
  await db.ship.update({ where: { id: ship.id }, data: { status: "POSTED" } });

  return { postId: post.id, shortCode, trackedUrl: trackedUrl(shortCode), destUrl };
}

/** Log a CLICK and return the destination (with lw_ref appended). */
export async function ingestClick(shortCode: string): Promise<string | null> {
  const link = await db.trackedLink.findUnique({ where: { shortCode } });
  if (!link) return null;
  await db.event.create({
    data: { trackedLinkId: link.id, type: "CLICK" },
  });
  const u = new URL(link.destUrl);
  u.searchParams.set("lw_ref", shortCode);
  return u.toString();
}

/** Log a SIGNUP for a tracked link. Returns false if the code is unknown. */
export async function ingestSignup(
  shortCode: string,
  meta?: Record<string, unknown>,
): Promise<boolean> {
  const link = await db.trackedLink.findUnique({ where: { shortCode } });
  if (!link) return false;
  await db.event.create({
    data: {
      trackedLinkId: link.id,
      type: "SIGNUP",
      meta: meta ? (meta as object) : undefined,
    },
  });
  return true;
}

// ── Read side ──────────────────────────────────────────────

export type ResultRow = {
  channelName: string;
  shipTitle: string;
  clicks: number;
  signups: number;
  conversion: number; // 0..1
  removed: boolean;
};

export type ResultsRollup = {
  rows: ResultRow[];
  totalClicks: number;
  totalSignups: number;
  insight: string | null;
};

export async function getResultsRollup(
  projectId: string,
): Promise<ResultsRollup> {
  const posts = await db.post.findMany({
    where: { ship: { projectId } },
    include: {
      channel: { select: { name: true } },
      ship: { select: { title: true } },
      trackedLink: { include: { events: { select: { type: true } } } },
    },
    orderBy: { postedAt: "desc" },
  });

  const rows: ResultRow[] = posts.map((p) => {
    const events = p.trackedLink?.events ?? [];
    const clicks = events.filter((e) => e.type === "CLICK").length;
    const signups = events.filter((e) => e.type === "SIGNUP").length;
    return {
      channelName: p.channel.name,
      shipTitle: p.ship.title,
      clicks,
      signups,
      conversion: clicks > 0 ? signups / clicks : 0,
      removed: p.status === "REMOVED",
    };
  });

  return {
    rows,
    totalClicks: rows.reduce((n, r) => n + r.clicks, 0),
    totalSignups: rows.reduce((n, r) => n + r.signups, 0),
    insight: buildInsight(rows),
  };
}

/**
 * Heuristic "What LaunchWake sees" line (double down / avoid). Deterministic and
 * free — no LLM call on every Results view.
 */
export function buildInsight(rows: ResultRow[]): string | null {
  if (rows.length === 0) return null;

  const removed = rows.filter((r) => r.removed);
  const converting = rows
    .filter((r) => !r.removed && r.signups > 0)
    .sort((a, b) => b.conversion - a.conversion);

  if (converting.length === 0) {
    if (removed.length > 0) {
      return `Nothing has converted yet, and ${removed[0].channelName} removed your post — skip it and lead with a value-first angle next time.`;
    }
    return "Clicks are coming in but no signups yet — check that the tracking pixel is installed on your signup success page.";
  }

  const best = converting[0];
  const parts = [
    `${best.channelName} converts best for this product (${(best.conversion * 100).toFixed(1)}% on ${best.shipTitle}).`,
  ];
  if (converting[1]) {
    parts.push(`${converting[1].channelName} is a solid second.`);
  }
  if (removed.length > 0) {
    parts.push(`Skip ${removed[0].channelName} — your post there was removed.`);
  }
  parts.push(`For the next ship, double down on ${best.channelName}.`);
  return parts.join(" ");
}
