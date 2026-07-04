import { randomBytes } from "crypto";
import { db } from "./db";
import { env } from "./env";
import { isSafeHttpUrl } from "./url";
import type { CoachResult } from "./coach";
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
  const dest = u.toString();
  // A tracked link may only ever point at a real http(s) product URL — never a
  // javascript:/data:/etc. scheme (would make the redirector an XSS vector).
  if (!isSafeHttpUrl(dest)) {
    throw new Error(`Refusing to build tracked link for unsafe URL: ${productUrl}`);
  }
  return dest;
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
export async function ingestClick(
  shortCode: string,
  opts: { record?: boolean } = {},
): Promise<string | null> {
  const link = await db.trackedLink.findUnique({ where: { shortCode } });
  if (!link) return null;
  // Read-time open-redirect guard: never 302 to a non-http(s) destination even
  // if a bad value somehow reached the row. Caller falls back to the home page.
  if (!isSafeHttpUrl(link.destUrl)) return null;
  // `record: false` (rate-limited hits) still redirects the human but does not
  // log a CLICK — so a script can't inflate a channel's click count.
  if (opts.record !== false) {
    await db.event.create({
      data: { trackedLinkId: link.id, type: "CLICK" },
    });
  }
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

export type RevenueInput = {
  /** Amount in the smallest currency unit (e.g. cents). */
  amountCents: number;
  /** ISO currency code (defaults to "usd"). */
  currency?: string;
  /** Subscription/recurring revenue counts toward MRR. */
  recurring?: boolean;
  meta?: Record<string, unknown>;
};

/**
 * Log REVENUE for a tracked link — the strongest signal: this channel didn't
 * just drive a signup, it drove money. Returns false if the code is unknown or
 * the amount is non-positive.
 */
export async function ingestRevenue(
  shortCode: string,
  input: RevenueInput,
): Promise<boolean> {
  if (!Number.isFinite(input.amountCents) || input.amountCents <= 0) return false;
  const link = await db.trackedLink.findUnique({ where: { shortCode } });
  if (!link) return false;
  await db.event.create({
    data: {
      trackedLinkId: link.id,
      type: "REVENUE",
      amountCents: Math.round(input.amountCents),
      currency: (input.currency ?? "usd").toLowerCase(),
      recurring: Boolean(input.recurring),
      meta: input.meta ? (input.meta as object) : undefined,
    },
  });
  return true;
}

// ── Read side ──────────────────────────────────────────────

export type ResultRow = {
  postId: string;
  channelName: string;
  shipTitle: string;
  trackedUrl: string | null;
  postUrl: string | null;
  clicks: number;
  signups: number;
  conversion: number; // 0..1
  revenueCents: number;
  recurringCents: number;
  removed: boolean;
  /** Cached post-mortem coaching, if the founder has run it. */
  coaching: CoachResult | null;
};

/** Aggregate across all ships — "which channel actually brings customers". */
export type ChannelRollup = {
  channelName: string;
  posts: number;
  clicks: number;
  signups: number;
  conversion: number;
  revenueCents: number;
  recurringCents: number;
};

/** ROI headline for a launch: effort in → clicks → signups → money out. */
export type RoiSummary = {
  posts: number;
  effortMinutes: number;
  effortLabel: string;
  clicks: number;
  signups: number;
  revenueCents: number;
  recurringCents: number;
  currency: string;
};

export type ResultsRollup = {
  perPost: ResultRow[];
  perChannel: ChannelRollup[];
  totalClicks: number;
  totalSignups: number;
  conversion: number;
  totalRevenueCents: number;
  mrrCents: number;
  currency: string;
  bestChannel: string | null;
  /** Channel that drove the most revenue (the flagship line). */
  topRevenueChannel: { name: string; revenueCents: number } | null;
  roi: RoiSummary;
  insight: string | null;
};

/**
 * Rough effort estimate for a launch: ~18 min per channel to tailor the draft,
 * post it, and engage. Deliberately conservative — the point is to contrast a
 * couple hours of work against the outcome.
 */
export function estimateEffortMinutes(posts: number): number {
  return posts * 18;
}

export function formatEffort(minutes: number): string {
  if (minutes <= 0) return "0m";
  if (minutes < 60) return `${minutes}m`;
  const h = minutes / 60;
  // one decimal below 10h, else whole hours
  const val = h < 10 ? Math.round(h * 10) / 10 : Math.round(h);
  return `${val}h`;
}

/** Format a smallest-unit amount as money (e.g. 34000, "usd" → "$340"). */
export function formatMoney(cents: number, currency = "usd"): string {
  try {
    const fmt = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
      maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
    });
    return fmt.format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(0)} ${currency.toUpperCase()}`;
  }
}

/**
 * Per-channel/post/total attribution rollup. Pass `shipId` to scope it to one
 * launch (the plan-level ROI summary); omit it for the project-wide Results.
 */
export async function getResultsRollup(
  projectId: string,
  opts?: { shipId?: string },
): Promise<ResultsRollup> {
  const posts = await db.post.findMany({
    where: {
      ship: opts?.shipId ? { id: opts.shipId, projectId } : { projectId },
    },
    include: {
      channel: { select: { name: true } },
      ship: { select: { title: true } },
      trackedLink: {
        include: {
          events: { select: { type: true, amountCents: true, recurring: true, currency: true } },
        },
      },
    },
    orderBy: { postedAt: "desc" },
  });

  let currency = "usd";

  const perPost: ResultRow[] = posts.map((p) => {
    const events = p.trackedLink?.events ?? [];
    let clicks = 0;
    let signups = 0;
    let revenueCents = 0;
    let recurringCents = 0;
    for (const e of events) {
      if (e.type === "CLICK") clicks += 1;
      else if (e.type === "SIGNUP") signups += 1;
      else if (e.type === "REVENUE") {
        const amt = e.amountCents ?? 0;
        revenueCents += amt;
        if (e.recurring) recurringCents += amt;
        if (e.currency) currency = e.currency;
      }
    }
    return {
      postId: p.id,
      channelName: p.channel.name,
      shipTitle: p.ship.title,
      trackedUrl: p.trackedLink ? trackedUrl(p.trackedLink.shortCode) : null,
      postUrl: p.url,
      clicks,
      signups,
      conversion: clicks > 0 ? signups / clicks : 0,
      revenueCents,
      recurringCents,
      removed: p.status === "REMOVED",
      coaching: (p.coachingJson as CoachResult | null) ?? null,
    };
  });

  // Roll up by channel across ships.
  const byChannel = new Map<string, ChannelRollup>();
  for (const r of perPost) {
    const c =
      byChannel.get(r.channelName) ??
      {
        channelName: r.channelName,
        posts: 0,
        clicks: 0,
        signups: 0,
        conversion: 0,
        revenueCents: 0,
        recurringCents: 0,
      };
    c.posts += 1;
    c.clicks += r.clicks;
    c.signups += r.signups;
    c.revenueCents += r.revenueCents;
    c.recurringCents += r.recurringCents;
    byChannel.set(r.channelName, c);
  }
  const perChannel = [...byChannel.values()]
    .map((c) => ({ ...c, conversion: c.clicks > 0 ? c.signups / c.clicks : 0 }))
    .sort(
      (a, b) =>
        b.revenueCents - a.revenueCents ||
        b.signups - a.signups ||
        b.conversion - a.conversion,
    );

  const totalClicks = perPost.reduce((n, r) => n + r.clicks, 0);
  const totalSignups = perPost.reduce((n, r) => n + r.signups, 0);
  const totalRevenueCents = perPost.reduce((n, r) => n + r.revenueCents, 0);
  const mrrCents = perPost.reduce((n, r) => n + r.recurringCents, 0);
  const postCount = perPost.length;
  const effortMinutes = estimateEffortMinutes(postCount);

  const topRev = perChannel.find((c) => c.revenueCents > 0) ?? null;

  return {
    perPost,
    perChannel,
    totalClicks,
    totalSignups,
    conversion: totalClicks > 0 ? totalSignups / totalClicks : 0,
    totalRevenueCents,
    mrrCents,
    currency,
    bestChannel: perChannel.find((c) => c.signups > 0)?.channelName ?? null,
    topRevenueChannel: topRev
      ? { name: topRev.channelName, revenueCents: topRev.revenueCents }
      : null,
    roi: {
      posts: postCount,
      effortMinutes,
      effortLabel: formatEffort(effortMinutes),
      clicks: totalClicks,
      signups: totalSignups,
      revenueCents: totalRevenueCents,
      recurringCents: mrrCents,
      currency,
    },
    insight: buildInsight(perPost),
  };
}

export type TrackingStatus = {
  signups: number;
  clicks: number;
  lastClickAt: Date | null;
  lastSignupAt: Date | null;
  revenueEvents: number;
  revenueCents: number;
  currency: string;
  lastRevenueAt: Date | null;
};

/** For the Settings pixel card — is data actually flowing in? */
export async function getTrackingStatus(
  projectId: string,
): Promise<TrackingStatus> {
  const where = {
    trackedLink: { post: { ship: { projectId } } },
  } as const;
  const [signups, clicks, lastClick, last, revAgg, lastRev] = await Promise.all([
    db.event.count({ where: { ...where, type: "SIGNUP" } }),
    db.event.count({ where: { ...where, type: "CLICK" } }),
    db.event.findFirst({
      where: { ...where, type: "CLICK" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    db.event.findFirst({
      where: { ...where, type: "SIGNUP" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    db.event.aggregate({
      where: { ...where, type: "REVENUE" },
      _sum: { amountCents: true },
      _count: { _all: true },
    }),
    db.event.findFirst({
      where: { ...where, type: "REVENUE" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, currency: true },
    }),
  ]);
  return {
    signups,
    clicks,
    lastClickAt: lastClick?.createdAt ?? null,
    lastSignupAt: last?.createdAt ?? null,
    revenueEvents: revAgg._count._all,
    revenueCents: revAgg._sum.amountCents ?? 0,
    currency: lastRev?.currency ?? "usd",
    lastRevenueAt: lastRev?.createdAt ?? null,
  };
}

// ── Live results (polled by the plan page) ─────────────────

export type LiveChannel = { name: string; clicks: number; signups: number };

export type ShipLiveStats = {
  /** true once ANY click or signup has been recorded for this ship. */
  tracking: boolean;
  totalClicks: number;
  totalSignups: number;
  /** channels with a live tracked link (whether or not they've had events). */
  postsTracked: number;
  /** most recent click/signup time, or null — drives the "just now" confirmation. */
  lastEventAt: Date | null;
  channels: LiveChannel[];
};

export type LivePostInput = {
  channelName: string;
  hasTrackedLink: boolean;
  events: { type: EventTypeLike; createdAt: Date }[];
};

type EventTypeLike = "CLICK" | "SIGNUP" | "REVENUE" | string;

/**
 * Fold a ship's posts + events into a compact live summary. Pure → unit-testable
 * without a DB. Only channels with a tracked link count as "tracked"; only
 * clicks/signups drive the tracking-is-working confirmation.
 */
export function summarizeLiveStats(posts: LivePostInput[]): ShipLiveStats {
  const channels: LiveChannel[] = [];
  let totalClicks = 0;
  let totalSignups = 0;
  let postsTracked = 0;
  let lastEventAt: Date | null = null;

  for (const p of posts) {
    if (!p.hasTrackedLink) continue;
    postsTracked += 1;
    let clicks = 0;
    let signups = 0;
    for (const e of p.events) {
      if (e.type === "CLICK") clicks += 1;
      else if (e.type === "SIGNUP") signups += 1;
      else continue; // ignore REVENUE etc. for the live click/signup view
      if (!lastEventAt || e.createdAt > lastEventAt) lastEventAt = e.createdAt;
    }
    totalClicks += clicks;
    totalSignups += signups;
    channels.push({ name: p.channelName, clicks, signups });
  }

  // Most active channel first, so the useful line is at the top.
  channels.sort(
    (a, b) =>
      b.signups - a.signups || b.clicks - a.clicks || a.name.localeCompare(b.name),
  );

  return {
    tracking: totalClicks > 0 || totalSignups > 0,
    totalClicks,
    totalSignups,
    postsTracked,
    lastEventAt,
    channels,
  };
}

/**
 * Per-channel live click/signup counts for ONE ship — the polling source for the
 * plan page's live-results strip. Ownership-scoped: returns null when the ship
 * isn't in this account, so the route can 404 without leaking existence.
 */
export async function getShipLiveStats(
  shipId: string,
  accountId: string,
): Promise<ShipLiveStats | null> {
  const ship = await db.ship.findFirst({
    where: { id: shipId, project: { userId: accountId } },
    select: { id: true },
  });
  if (!ship) return null;

  const posts = await db.post.findMany({
    where: { shipId },
    select: {
      channel: { select: { name: true } },
      trackedLink: {
        select: { events: { select: { type: true, createdAt: true } } },
      },
    },
    orderBy: { postedAt: "asc" },
  });

  return summarizeLiveStats(
    posts.map((p) => ({
      channelName: p.channel.name,
      hasTrackedLink: Boolean(p.trackedLink),
      events: p.trackedLink?.events ?? [],
    })),
  );
}

/**
 * Heuristic "What LaunchWake sees" line (double down / avoid). Deterministic and
 * free — no LLM call on every Results view.
 */
export function buildInsight(rows: ResultRow[]): string | null {
  if (rows.length === 0) return null;

  const removed = rows.filter((r) => r.removed);

  // Revenue is the strongest signal — lead with it when we have it.
  const earning = rows
    .filter((r) => r.revenueCents > 0)
    .sort((a, b) => b.revenueCents - a.revenueCents);
  if (earning.length > 0) {
    const top = earning[0];
    const parts = [
      `${top.channelName} drove ${formatMoney(top.revenueCents)} in attributed revenue${
        top.recurringCents > 0 ? ` (${formatMoney(top.recurringCents)} recurring)` : ""
      } — your best channel by money, not just signups.`,
    ];
    if (earning[1]) {
      parts.push(`${earning[1].channelName} is second at ${formatMoney(earning[1].revenueCents)}.`);
    }
    parts.push(`For the next ship, put your best effort into ${top.channelName}.`);
    return parts.join(" ");
  }

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
