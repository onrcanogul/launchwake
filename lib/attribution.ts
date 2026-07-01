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
  trackedUrl: string | null;
  postUrl: string | null;
  clicks: number;
  signups: number;
  conversion: number; // 0..1
  removed: boolean;
};

/** Aggregate across all ships — "which channel actually brings customers". */
export type ChannelRollup = {
  channelName: string;
  posts: number;
  clicks: number;
  signups: number;
  conversion: number;
};

export type ResultsRollup = {
  perPost: ResultRow[];
  perChannel: ChannelRollup[];
  totalClicks: number;
  totalSignups: number;
  conversion: number;
  bestChannel: string | null;
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

  const perPost: ResultRow[] = posts.map((p) => {
    const events = p.trackedLink?.events ?? [];
    const clicks = events.filter((e) => e.type === "CLICK").length;
    const signups = events.filter((e) => e.type === "SIGNUP").length;
    return {
      channelName: p.channel.name,
      shipTitle: p.ship.title,
      trackedUrl: p.trackedLink ? trackedUrl(p.trackedLink.shortCode) : null,
      postUrl: p.url,
      clicks,
      signups,
      conversion: clicks > 0 ? signups / clicks : 0,
      removed: p.status === "REMOVED",
    };
  });

  // Roll up by channel across ships.
  const byChannel = new Map<string, ChannelRollup>();
  for (const r of perPost) {
    const c =
      byChannel.get(r.channelName) ??
      { channelName: r.channelName, posts: 0, clicks: 0, signups: 0, conversion: 0 };
    c.posts += 1;
    c.clicks += r.clicks;
    c.signups += r.signups;
    byChannel.set(r.channelName, c);
  }
  const perChannel = [...byChannel.values()]
    .map((c) => ({ ...c, conversion: c.clicks > 0 ? c.signups / c.clicks : 0 }))
    .sort((a, b) => b.signups - a.signups || b.conversion - a.conversion);

  const totalClicks = perPost.reduce((n, r) => n + r.clicks, 0);
  const totalSignups = perPost.reduce((n, r) => n + r.signups, 0);

  return {
    perPost,
    perChannel,
    totalClicks,
    totalSignups,
    conversion: totalClicks > 0 ? totalSignups / totalClicks : 0,
    bestChannel: perChannel.find((c) => c.signups > 0)?.channelName ?? null,
    insight: buildInsight(perPost),
  };
}

export type TrackingStatus = {
  signups: number;
  clicks: number;
  lastSignupAt: Date | null;
};

/** For the Settings pixel card — is data actually flowing in? */
export async function getTrackingStatus(
  projectId: string,
): Promise<TrackingStatus> {
  const where = {
    trackedLink: { post: { ship: { projectId } } },
  } as const;
  const [signups, clicks, last] = await Promise.all([
    db.event.count({ where: { ...where, type: "SIGNUP" } }),
    db.event.count({ where: { ...where, type: "CLICK" } }),
    db.event.findFirst({
      where: { ...where, type: "SIGNUP" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);
  return { signups, clicks, lastSignupAt: last?.createdAt ?? null };
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
