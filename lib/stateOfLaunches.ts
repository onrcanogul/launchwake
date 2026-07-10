import { db } from "./db";
import { bucketLabel } from "./stats";
import { MIN_PUBLIC_SAMPLE } from "./benchmarks";
import type { BanRisk, Platform } from "@prisma/client";

/**
 * "State of Developer Launches" — the annual content asset (roadmap 1.5).
 *
 * A login-less, anonymized aggregate view of the outcome flywheel: which
 * channels drive signups, which convert best, how they differ by product
 * category, which platforms remove posts most, and when to post. This is the
 * backlink magnet / press piece, and it is built ENTIRELY from `ChannelStat`
 * (already aggregated across all projects by product bucket) — never from any
 * single founder's data.
 *
 * Privacy is a product principle here: every published line is gated by a
 * minimum sample so no individual founder's numbers can be inferred. The build
 * step is a PURE function over structural rows so it is unit-testable and the
 * page can be statically rendered / revalidated.
 */

// ── Privacy / significance gates ───────────────────────────

/**
 * A channel (or channel×category) line is only published once it aggregates at
 * least this many posts. This is a k-anonymity-style guard — small buckets could
 * reflect a single founder — and it keeps the numbers statistically meaningful.
 */
export const MIN_SAMPLE_POSTS = 5;

/** Conversion leaderboards need enough traffic before a rate is trustworthy. */
export const MIN_CONVERSION_CLICKS = 20;

// ── Structural input (DB-free → testable) ──────────────────

export type BanRiskLike = "LOW" | "MEDIUM" | "HIGH";

/** One `ChannelStat` row flattened with its channel's catalog facts. */
export type StatRow = {
  channelName: string;
  platform: string;
  banRisk: BanRiskLike;
  bestTime: string | null;
  /** product bucket, e.g. "devtools-backend". */
  productTag: string;
  posts: number;
  clicks: number;
  signups: number;
  removals: number;
};

// ── Output shape ───────────────────────────────────────────

export type ChannelLeader = {
  name: string;
  platform: string;
  banRisk: BanRiskLike;
  bestTime: string | null;
  posts: number;
  clicks: number;
  signups: number;
  removals: number;
  /** signups / clicks, 0..1 (0 when no clicks). */
  conversion: number;
  /** removals / posts, 0..1. */
  removalRate: number;
};

export type CategoryBreakdown = {
  /** first bucket segment, e.g. "devtools". */
  tag: string;
  label: string;
  posts: number;
  signups: number;
  /** best channels within this category, by signups (gated). */
  topChannels: ChannelLeader[];
};

export type PlatformBanRate = {
  platform: string;
  posts: number;
  removals: number;
  removalRate: number;
};

export type BestTimeWindow = {
  window: string;
  /** channels (from the catalog) that recommend this window. */
  channels: string[];
  /** total signups attributed to those channels. */
  signups: number;
};

export type StateOfLaunches = {
  hasData: boolean;
  totals: {
    launches: number;
    clicks: number;
    signups: number;
    /** overall signups / clicks, 0..1. */
    conversion: number;
    channelsRanked: number;
    categories: number;
  };
  /** overall leaderboard by signups (gated). */
  topChannels: ChannelLeader[];
  /** highest signup-per-click among channels with enough traffic. */
  bestConverters: ChannelLeader[];
  /** per-category winners, richest categories first. */
  categories: CategoryBreakdown[];
  /** removal rate by platform, worst first. */
  banRates: PlatformBanRate[];
  /** timing windows ranked by the signups they drove. */
  bestTimes: BestTimeWindow[];
};

// ── Aggregation helpers ────────────────────────────────────

type ChannelAcc = {
  name: string;
  platform: string;
  banRisk: BanRiskLike;
  bestTime: string | null;
  posts: number;
  clicks: number;
  signups: number;
  removals: number;
};

function emptyChannel(row: StatRow): ChannelAcc {
  return {
    name: row.channelName,
    platform: row.platform,
    banRisk: row.banRisk,
    bestTime: row.bestTime,
    posts: 0,
    clicks: 0,
    signups: 0,
    removals: 0,
  };
}

function addRow(acc: ChannelAcc, row: StatRow): void {
  acc.posts += row.posts;
  acc.clicks += row.clicks;
  acc.signups += row.signups;
  acc.removals += row.removals;
}

function toLeader(acc: ChannelAcc): ChannelLeader {
  return {
    name: acc.name,
    platform: acc.platform,
    banRisk: acc.banRisk,
    bestTime: acc.bestTime,
    posts: acc.posts,
    clicks: acc.clicks,
    signups: acc.signups,
    removals: acc.removals,
    conversion: acc.clicks > 0 ? acc.signups / acc.clicks : 0,
    removalRate: acc.posts > 0 ? acc.removals / acc.posts : 0,
  };
}

/** Aggregate a set of rows into per-channel leaders (ungated). */
function aggregateByChannel(rows: StatRow[]): Map<string, ChannelAcc> {
  const map = new Map<string, ChannelAcc>();
  for (const row of rows) {
    const acc = map.get(row.channelName) ?? emptyChannel(row);
    addRow(acc, row);
    map.set(row.channelName, acc);
  }
  return map;
}

/** Signups desc, then conversion desc, then name — a stable, legible order. */
function bySignups(a: ChannelLeader, b: ChannelLeader): number {
  if (b.signups !== a.signups) return b.signups - a.signups;
  if (b.conversion !== a.conversion) return b.conversion - a.conversion;
  return a.name.localeCompare(b.name);
}

/** Humanized category label; "general" isn't a real category, so relabel it. */
function categoryLabel(tag: string): string {
  const label = bucketLabel(tag);
  return label === "products like yours" ? "General" : label;
}

// ── The build (pure) ───────────────────────────────────────

/**
 * Turn raw `ChannelStat` rows into the published report. Everything below the
 * headline is gated so a small (potentially single-founder) bucket never leaks.
 */
export function buildStateOfLaunches(rows: StatRow[]): StateOfLaunches {
  // Overall per-channel leaderboard (summed across every category bucket).
  const overall = [...aggregateByChannel(rows).values()]
    .filter((c) => c.posts >= MIN_SAMPLE_POSTS)
    .map(toLeader);

  const topChannels = [...overall].sort(bySignups).slice(0, 10);

  const bestConverters = overall
    .filter((c) => c.clicks >= MIN_CONVERSION_CLICKS && c.signups > 0)
    .sort((a, b) => b.conversion - a.conversion || b.signups - a.signups)
    .slice(0, 6);

  // Categories: group rows by the leading bucket segment.
  const byCategory = new Map<string, StatRow[]>();
  for (const row of rows) {
    const tag = (row.productTag.split("-")[0] || "general").toLowerCase();
    const list = byCategory.get(tag) ?? [];
    list.push(row);
    byCategory.set(tag, list);
  }

  const categories: CategoryBreakdown[] = [];
  for (const [tag, catRows] of byCategory) {
    const leaders = [...aggregateByChannel(catRows).values()]
      .filter((c) => c.posts >= MIN_SAMPLE_POSTS)
      .map(toLeader)
      .sort(bySignups);
    if (leaders.length === 0) continue;
    categories.push({
      tag,
      label: categoryLabel(tag),
      posts: leaders.reduce((n, c) => n + c.posts, 0),
      signups: leaders.reduce((n, c) => n + c.signups, 0),
      topChannels: leaders.slice(0, 3),
    });
  }
  categories.sort((a, b) => b.signups - a.signups || b.posts - a.posts);

  // Ban rate by platform — every row counts (removals are a safety signal even
  // in small buckets), but gate on posts so the rate isn't one unlucky post.
  const platformAcc = new Map<string, { posts: number; removals: number }>();
  for (const row of rows) {
    const acc = platformAcc.get(row.platform) ?? { posts: 0, removals: 0 };
    acc.posts += row.posts;
    acc.removals += row.removals;
    platformAcc.set(row.platform, acc);
  }
  const banRates: PlatformBanRate[] = [...platformAcc.entries()]
    .filter(([, v]) => v.posts >= MIN_SAMPLE_POSTS)
    .map(([platform, v]) => ({
      platform,
      posts: v.posts,
      removals: v.removals,
      removalRate: v.posts > 0 ? v.removals / v.posts : 0,
    }))
    .sort((a, b) => b.removalRate - a.removalRate || b.posts - a.posts);

  // Best times — group gated channels by their recommended window.
  const timeAcc = new Map<string, { channels: Set<string>; signups: number }>();
  for (const c of overall) {
    if (!c.bestTime) continue;
    const acc = timeAcc.get(c.bestTime) ?? { channels: new Set(), signups: 0 };
    acc.channels.add(c.name);
    acc.signups += c.signups;
    timeAcc.set(c.bestTime, acc);
  }
  const bestTimes: BestTimeWindow[] = [...timeAcc.entries()]
    .map(([window, v]) => ({
      window,
      channels: [...v.channels].sort(),
      signups: v.signups,
    }))
    .sort((a, b) => b.signups - a.signups || b.channels.length - a.channels.length)
    .slice(0, 6);

  const totalClicks = overall.reduce((n, c) => n + c.clicks, 0);
  const totalSignups = overall.reduce((n, c) => n + c.signups, 0);
  const totalLaunches = overall.reduce((n, c) => n + c.posts, 0);

  return {
    hasData: topChannels.length > 0,
    totals: {
      launches: totalLaunches,
      clicks: totalClicks,
      signups: totalSignups,
      conversion: totalClicks > 0 ? totalSignups / totalClicks : 0,
      channelsRanked: overall.length,
      categories: categories.length,
    },
    topChannels,
    bestConverters,
    categories,
    banRates,
    bestTimes,
  };
}

/** Headline numbers for OG cards / meta descriptions (pure). */
export function stateOfLaunchesOgStats(
  report: StateOfLaunches,
): { label: string; value: string }[] {
  return [
    { label: "launches", value: report.totals.launches.toLocaleString() },
    { label: "signups tracked", value: report.totals.signups.toLocaleString() },
    { label: "channels", value: report.totals.channelsRanked.toLocaleString() },
  ];
}

// ── Public benchmark board (cold-start engagement) ─────────

/**
 * The public page is built from first-party `ChannelStat`, which is empty until
 * enough launches are tracked. This second, independent board surfaces the
 * public-engagement bootstrap (`ChannelBenchmark` medians from HN/PH, last 90
 * days) so the page shows real category signal on day one instead of only a
 * "compiling" gate. It is NEVER blended into the first-party numbers — it renders
 * as its own clearly-labelled section. Pure over structural rows → testable.
 */
export type PublicBenchRow = {
  channelName: string;
  platform: string;
  productTag: string;
  publicSample: number;
  medianUpvotes: number;
};

export type PublicBenchLeader = {
  name: string;
  platform: string;
  medianUpvotes: number;
  publicSample: number;
};

export type PublicBenchCategory = {
  tag: string;
  label: string;
  channels: PublicBenchLeader[];
};

export type PublicBenchmarkBoard = {
  hasData: boolean;
  categories: PublicBenchCategory[];
};

export function buildPublicBenchmarkBoard(rows: PublicBenchRow[]): PublicBenchmarkBoard {
  // Group gated rows by leading category segment; keep the strongest median per
  // channel within a category (a channel can appear under several product tags).
  const byCategory = new Map<string, Map<string, PublicBenchLeader>>();
  for (const r of rows) {
    if (r.publicSample < MIN_PUBLIC_SAMPLE || r.medianUpvotes <= 0) continue;
    const tag = (r.productTag.split("-")[0] || "general").toLowerCase();
    const cat = byCategory.get(tag) ?? new Map<string, PublicBenchLeader>();
    const existing = cat.get(r.channelName);
    if (!existing || r.medianUpvotes > existing.medianUpvotes) {
      cat.set(r.channelName, {
        name: r.channelName,
        platform: r.platform,
        medianUpvotes: r.medianUpvotes,
        publicSample: r.publicSample,
      });
    }
    byCategory.set(tag, cat);
  }

  const categories: PublicBenchCategory[] = [];
  for (const [tag, chans] of byCategory) {
    const channels = [...chans.values()]
      .sort((a, b) => b.medianUpvotes - a.medianUpvotes || a.name.localeCompare(b.name))
      .slice(0, 4);
    if (channels.length === 0) continue;
    categories.push({ tag, label: categoryLabel(tag), channels });
  }
  categories.sort(
    (a, b) =>
      (b.channels[0]?.medianUpvotes ?? 0) - (a.channels[0]?.medianUpvotes ?? 0) ||
      a.label.localeCompare(b.label),
  );

  return { hasData: categories.length > 0, categories };
}

// ── DB fetcher (thin) ──────────────────────────────────────

/** Load the aggregate flywheel and build the public report. */
export async function getStateOfLaunches(): Promise<StateOfLaunches> {
  const rows = await db.channelStat.findMany({
    include: {
      channel: {
        select: {
          name: true,
          platform: true,
          defaultBanRisk: true,
          bestTime: true,
        },
      },
    },
  });

  const mapped: StatRow[] = rows.map((r) => ({
    channelName: r.channel.name,
    platform: r.channel.platform as Platform,
    banRisk: r.channel.defaultBanRisk as BanRisk,
    bestTime: r.channel.bestTime,
    productTag: r.productTag,
    posts: r.posts,
    clicks: r.clicks,
    signups: r.signups,
    removals: r.removals,
  }));

  return buildStateOfLaunches(mapped);
}

/** Load the public-engagement bootstrap and build the public benchmark board. */
export async function getPublicBenchmarkBoard(): Promise<PublicBenchmarkBoard> {
  const rows = await db.channelBenchmark.findMany({
    where: { publicSample: { gte: MIN_PUBLIC_SAMPLE } },
    include: { channel: { select: { name: true, platform: true } } },
  });
  return buildPublicBenchmarkBoard(
    rows.map((r) => ({
      channelName: r.channel.name,
      platform: r.channel.platform,
      productTag: r.productTag,
      publicSample: r.publicSample,
      medianUpvotes: r.medianUpvotes,
    })),
  );
}
