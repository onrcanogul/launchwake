import { db } from "./db";
import { env } from "./env";
import { productTagFor, bucketLabel } from "./stats";

/**
 * Category benchmarks — the paywall trigger.
 *
 * At the decision moment ("should I invest in this channel?"), show per-channel
 * aggregate proof for the founder's category: "devtool products got a median of
 * 34 signups from Show HN; 6 from r/SaaS." The number exists nowhere else, so a
 * locked/blurred version is a far stronger paywall trigger than "unlimited plans".
 *
 * Data blends two honest sources:
 *   - first-party: median signups per post, aggregated anonymously across ALL
 *     accounts for a (category, channel) — the real thing, once data exists.
 *   - public bootstrap: median upvotes from HN/Reddit public APIs, so a category
 *     has a defensible engagement number on day one (cold start), clearly
 *     labelled while first-party signup data accumulates.
 *
 * Pure aggregators/formatters are unit-tested; the network is best-effort.
 */

// A channel needs this many tracked posts before we trust its first-party median.
export const MIN_FIRST_PARTY_POSTS = 3;
// Public engagement needs this many sampled launches to be worth showing.
export const MIN_PUBLIC_SAMPLE = 5;
// Cap network calls per rollup so a big catalog can't fan out unboundedly. The
// per-(query|subreddit) cache keeps distinct calls small even at full coverage
// (≈one HN/PH call per category query), so this is a generous safety ceiling.
const MAX_PUBLIC_FETCHES = 64;
// The public bootstrap reports engagement over this trailing window. HN Algolia
// and Product Hunt filter to it precisely; the label says "last 90 days".
export const PUBLIC_WINDOW_DAYS = 90;

export type BenchmarkSource = "first-party" | "public" | "blended";

/**
 * Every leading `productTagFor` bucket we guarantee cold-start coverage for, so
 * a brand-new category still gets a public median for its top launch venues even
 * before any founder has posted in it. Mirrors `BUCKET_PRIORITY` in stats.ts,
 * plus the "general" catch-all bucket.
 */
export const COVERAGE_BUCKETS = [
  "devtools",
  "saas",
  "webdev",
  "devops",
  "infra",
  "ai",
  "opensource",
  "selfhosted",
  "node",
  "javascript",
  "frontend",
  "backend",
  "b2b",
  "founders",
  "general",
] as const;

/**
 * The public "launch" venues we bootstrap coverage from: Hacker News (Show HN,
 * via Algolia) and Product Hunt. Both support a precise 90-day window, so their
 * medians can honestly carry the "HN/PH, last 90 days" label. Reddit medians are
 * per-subreddit and only bootstrapped when a subreddit already appears in a real
 * plan/post (see `bootstrapPublic`), never as blanket category coverage.
 */
const COVERAGE_PLATFORMS = new Set(["HACKERNEWS", "PRODUCTHUNT"]);
const RISK_RANK: Record<string, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 };

/**
 * Honest per-source label for a public number, derived from the channel's own
 * platform — so a row never claims a source it didn't come from. HN/PH carry the
 * 90-day launch window; Reddit's public feed only exposes a trailing month.
 */
export function publicSource(platform: string): {
  abbrev: string;
  name: string;
  window: string;
} {
  switch (platform) {
    case "HACKERNEWS":
      return { abbrev: "HN", name: "Hacker News", window: "last 90 days" };
    case "PRODUCTHUNT":
      return { abbrev: "PH", name: "Product Hunt", window: "last 90 days" };
    case "REDDIT":
      return { abbrev: "Reddit", name: "Reddit", window: "past 30 days" };
    default:
      return { abbrev: "public", name: "public sources", window: "recent" };
  }
}

// ── Pure: median ───────────────────────────────────────────
export function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

// ── Pure: first-party aggregation ──────────────────────────
export type PostRecord = {
  productTag: string;
  channelId: string;
  signups: number;
  clicks: number;
};

export type FirstPartyAgg = {
  productTag: string;
  channelId: string;
  sampleSize: number; // posts
  medianSignups: number;
  meanSignups: number;
  conversionPct: number; // total signups / total clicks * 100
};

/** Group per-post records by (category, channel) and compute medians. Pure. */
export function aggregateFirstParty(posts: PostRecord[]): FirstPartyAgg[] {
  const groups = new Map<string, { productTag: string; channelId: string; signups: number[]; clicks: number }>();
  for (const p of posts) {
    const key = `${p.productTag}::${p.channelId}`;
    const g =
      groups.get(key) ?? { productTag: p.productTag, channelId: p.channelId, signups: [], clicks: 0 };
    g.signups.push(p.signups);
    g.clicks += p.clicks;
    groups.set(key, g);
  }
  return [...groups.values()].map((g) => {
    const total = g.signups.reduce((a, b) => a + b, 0);
    return {
      productTag: g.productTag,
      channelId: g.channelId,
      sampleSize: g.signups.length,
      medianSignups: median(g.signups),
      meanSignups: g.signups.length ? total / g.signups.length : 0,
      conversionPct: g.clicks > 0 ? (total / g.clicks) * 100 : 0,
    };
  });
}

// ── Pure: display ──────────────────────────────────────────
export type ChannelBenchmarkView = {
  channelSlug: string;
  channelName: string;
  platform: string;
  sampleSize: number;
  medianSignups: number;
  meanSignups: number;
  conversionPct: number;
  publicSample: number;
  medianUpvotes: number;
  source: BenchmarkSource;
};

export type BenchmarkDisplay = {
  /** e.g. "Show HN median for dev-tools" */
  label: string;
  /** the number itself, e.g. "34 signups" — this is what's blurred when locked */
  value: string;
  /** supporting line, shown only when unlocked */
  sub: string | null;
  source: BenchmarkSource;
};

/**
 * The headline for one channel's benchmark, or null when there isn't enough to
 * show. Prefers real first-party signup medians; falls back to public
 * engagement while signup data is still building. Pure.
 */
export function benchmarkDisplay(
  b: Pick<
    ChannelBenchmarkView,
    | "channelName"
    | "platform"
    | "sampleSize"
    | "medianSignups"
    | "conversionPct"
    | "publicSample"
    | "medianUpvotes"
    | "source"
  >,
  categoryLabel: string,
): BenchmarkDisplay | null {
  // Once first-party signups clear the gate we lead with the real number — even
  // when public engagement also exists (a "blended" row keeps that label).
  if (b.sampleSize >= MIN_FIRST_PARTY_POSTS) {
    return {
      label: `${b.channelName} median for ${categoryLabel}`,
      value: `${b.medianSignups} signup${b.medianSignups === 1 ? "" : "s"}`,
      sub: `${b.conversionPct.toFixed(1)}% conversion · ${b.sampleSize} launches tracked`,
      source: b.source,
    };
  }
  // Cold start: fall back to public engagement, clearly labelled by its source
  // so it never reads as first-party signup data.
  if (b.publicSample >= MIN_PUBLIC_SAMPLE) {
    const src = publicSource(b.platform);
    return {
      label: `${b.channelName} engagement for ${categoryLabel}`,
      value: `${b.medianUpvotes} upvotes`,
      sub: `Public data (${src.abbrev}), ${src.window} · ${b.publicSample} launches · signup data building`,
      source: "public",
    };
  }
  return null;
}

// ── Pure: the public teaser line for the Launch Checker ────
/**
 * One header line for the public Launch Checker's detected category, built from
 * the precomputed benchmark table (no request-time fetch). Null when there isn't
 * a trustworthy public median yet. Pure → unit-testable.
 */
export function checkerBenchmarkLine(
  b: { medianUpvotes: number; publicSample: number } | null,
  categoryLabel: string,
  channelShort = "Show HN",
): string | null {
  if (!b || b.publicSample < MIN_PUBLIC_SAMPLE || b.medianUpvotes <= 0) return null;
  const pts = b.medianUpvotes;
  return `Public data: ${categoryLabel} ${channelShort} posts got a median of ${pts} point${pts === 1 ? "" : "s"} in the last 90 days`;
}

/** Category label for the current project (e.g. "dev-tools"). */
export function categoryLabelFor(projectText: string): string {
  return bucketLabel(productTagFor(projectText));
}

// ── Read model for the plan screen ─────────────────────────
/** Split a productTag into the tags to query: the exact tag + its leading bucket. */
function benchmarkTags(productTag: string): string[] {
  const leading = productTag.split("-")[0];
  return leading && leading !== productTag ? [productTag, leading] : [productTag];
}

/**
 * Benchmarks for a category, keyed by channel slug (for rec lookup).
 *
 * A 2-segment product (e.g. "devtools-backend") reads its exact-tag rows AND the
 * single-segment bucket rows ("devtools") that the cold-start bootstrap seeds.
 * Exact-tag rows win per channel, so a channel shows the public bucket median at
 * first and automatically switches to the product's own first-party/blended row
 * as real samples accumulate under the specific tag.
 */
export async function getBenchmarkMap(
  productTag: string,
): Promise<Map<string, ChannelBenchmarkView>> {
  const rows = await db.channelBenchmark.findMany({
    where: { productTag: { in: benchmarkTags(productTag) } },
    include: { channel: { select: { slug: true, name: true, platform: true } } },
  });
  // Bucket (fallback) rows first, exact-tag rows last, so exact overrides bucket.
  const ordered = [...rows].sort(
    (a, b) =>
      (a.productTag === productTag ? 1 : 0) - (b.productTag === productTag ? 1 : 0),
  );
  const map = new Map<string, ChannelBenchmarkView>();
  for (const r of ordered) {
    map.set(r.channel.slug, {
      channelSlug: r.channel.slug,
      channelName: r.channel.name,
      platform: r.channel.platform,
      sampleSize: r.sampleSize,
      medianSignups: r.medianSignups,
      meanSignups: r.meanSignups,
      conversionPct: r.conversionPct,
      publicSample: r.publicSample,
      medianUpvotes: r.medianUpvotes,
      source: (r.source as BenchmarkSource) ?? "public",
    });
  }
  return map;
}

/**
 * The public Launch Checker teaser line for a detected category — served from
 * the precomputed table with a single indexed read and ZERO network fetch. Picks
 * the category's Show HN public median (falling back to the leading bucket), the
 * one universal launch venue every category can post to.
 */
export async function getCheckerBenchmark(productTag: string): Promise<string | null> {
  const rows = await db.channelBenchmark.findMany({
    where: {
      productTag: { in: benchmarkTags(productTag) },
      channel: { platform: "HACKERNEWS" },
    },
    include: { channel: { select: { name: true, slug: true } } },
  });
  if (rows.length === 0) return null;
  // Prefer Show HN, then the exact tag, then the larger public sample.
  const best = [...rows].sort((a, b) => {
    const show = (a.channel.slug === "hn-show" ? 1 : 0) - (b.channel.slug === "hn-show" ? 1 : 0);
    if (show !== 0) return -show;
    const exact = (a.productTag === productTag ? 1 : 0) - (b.productTag === productTag ? 1 : 0);
    if (exact !== 0) return -exact;
    return b.publicSample - a.publicSample;
  })[0];
  const channelShort = best.channel.slug === "hn-show" ? "Show HN" : best.channel.name;
  return checkerBenchmarkLine(
    { medianUpvotes: best.medianUpvotes, publicSample: best.publicSample },
    bucketLabel(productTag),
    channelShort,
  );
}

// ── Public engagement bootstrap (best-effort, cached) ──────
const CATEGORY_QUERY: Record<string, string> = {
  devtools: "developer tools",
  saas: "saas",
  webdev: "web app",
  devops: "devops",
  infra: "infrastructure",
  ai: "ai",
  opensource: "open source",
  selfhosted: "self-hosted",
  node: "node",
  javascript: "javascript",
  frontend: "frontend",
  backend: "backend",
  b2b: "b2b saas",
  founders: "startup",
  general: "launch",
};

function categoryQuery(productTag: string): string {
  return CATEGORY_QUERY[productTag.split("-")[0]] ?? "launch";
}

function subredditOf(url: string | null | undefined): string | null {
  return url?.match(/reddit\.com\/r\/([^/]+)/i)?.[1] ?? null;
}

async function fetchJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(6000),
      headers: { "User-Agent": "LaunchWake-Benchmarks" },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Median upvotes for a category on Show HN, last 90 days. Best-effort. */
async function hnUpvotes(query: string): Promise<number[]> {
  const since = Math.floor((Date.now() - PUBLIC_WINDOW_DAYS * 86_400_000) / 1000);
  const url = `https://hn.algolia.com/api/v1/search?tags=show_hn&query=${encodeURIComponent(query)}&numericFilters=created_at_i>${since}&hitsPerPage=50`;
  const json = (await fetchJson(url)) as { hits?: { points?: number | null }[] } | null;
  return (json?.hits ?? [])
    .map((h) => h.points ?? 0)
    .filter((p) => Number.isFinite(p) && p > 0);
}

/**
 * Recent Product Hunt vote counts for a category, last 90 days. Token-gated: PH's
 * API needs an OAuth developer token, so this is a no-op (returns []) unless
 * `PRODUCT_HUNT_TOKEN` is configured — which keeps the "HN/PH" label honest (PH
 * only contributes when we can actually read it). Best-effort → [] on failure.
 */
async function phUpvotes(query: string): Promise<number[]> {
  const token = env.PRODUCT_HUNT_TOKEN;
  if (!token) return [];
  const postedAfter = new Date(Date.now() - PUBLIC_WINDOW_DAYS * 86_400_000).toISOString();
  const gql = {
    query:
      "query($q:String,$after:DateTime){posts(order:VOTES,first:50,postedAfter:$after){edges{node{votesCount topics{edges{node{name}}}}}}}",
    variables: { q: query, after: postedAfter },
  };
  try {
    const res = await fetch("https://api.producthunt.com/v2/api/graphql", {
      method: "POST",
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(6000),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "User-Agent": "LaunchWake-Benchmarks",
      },
      body: JSON.stringify(gql),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      data?: { posts?: { edges?: { node?: { votesCount?: number } }[] } };
    };
    return (json?.data?.posts?.edges ?? [])
      .map((e) => e.node?.votesCount ?? 0)
      .filter((v) => Number.isFinite(v) && v > 0);
  } catch {
    return [];
  }
}

/** Minimal catalog shape the coverage seeder needs (DB-free → testable). */
export type CatalogChannel = {
  id: string;
  slug: string;
  platform: string;
  url: string | null;
  tags: string[];
  defaultBanRisk: string;
};

/**
 * Cold-start bootstrap targets: for every `COVERAGE_BUCKETS` category, the top
 * launch venues (HN/PH) from the catalog by ban risk, always including Show HN so
 * a brand-new category still gets at least one public median. Pure → testable.
 */
export function coverageTargets(
  catalog: CatalogChannel[],
  perBucket = 3,
): BootstrapTarget[] {
  const out: BootstrapTarget[] = [];
  const seen = new Set<string>();
  const hnShow =
    catalog.find((c) => c.slug === "hn-show") ??
    catalog.find((c) => c.platform === "HACKERNEWS");

  for (const bucket of COVERAGE_BUCKETS) {
    const matched = catalog
      .filter((c) => COVERAGE_PLATFORMS.has(c.platform))
      .filter((c) =>
        bucket === "general"
          ? c.tags.includes("launch") || c.tags.includes("product")
          : c.tags.includes(bucket),
      )
      .sort(
        (a, b) =>
          (RISK_RANK[a.defaultBanRisk] ?? 9) - (RISK_RANK[b.defaultBanRisk] ?? 9) ||
          a.slug.localeCompare(b.slug),
      )
      .slice(0, perBucket);

    // Show HN is the universal launch venue — guarantee it for every bucket.
    const list =
      hnShow && !matched.some((c) => c.platform === "HACKERNEWS")
        ? [hnShow, ...matched]
        : matched;

    for (const c of list) {
      const key = `${bucket}::${c.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        productTag: bucket,
        channelId: c.id,
        platform: c.platform,
        channelUrl: c.url,
      });
    }
  }
  return out;
}

/** Median upvotes for a subreddit's recent top posts. Best-effort. */
async function redditUpvotes(subreddit: string): Promise<number[]> {
  const json = (await fetchJson(
    `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/top.json?t=month&limit=50`,
  )) as { data?: { children?: { data?: { score?: number; stickied?: boolean } }[] } } | null;
  return (json?.data?.children ?? [])
    .map((c) => c.data)
    .filter((d): d is { score?: number; stickied?: boolean } => Boolean(d) && !d?.stickied)
    .map((d) => d.score ?? 0)
    .filter((s) => s > 0);
}

type BootstrapTarget = {
  productTag: string;
  channelId: string;
  platform: string;
  channelUrl: string | null;
};

/**
 * Fill a `${productTag}::${channelId}` → {publicSample, medianUpvotes} map for
 * HN/Reddit channels, caching by (query|subreddit) so distinct network calls are
 * bounded. Never throws.
 */
async function bootstrapPublic(
  targets: BootstrapTarget[],
): Promise<Map<string, { publicSample: number; medianUpvotes: number }>> {
  const out = new Map<string, { publicSample: number; medianUpvotes: number }>();
  const fetchCache = new Map<string, number[]>();
  let fetches = 0;

  for (const t of targets) {
    let cacheKey: string | null = null;
    if (t.platform === "HACKERNEWS") cacheKey = `hn:${categoryQuery(t.productTag)}`;
    else if (t.platform === "PRODUCTHUNT") cacheKey = `ph:${categoryQuery(t.productTag)}`;
    else if (t.platform === "REDDIT") {
      const sub = subredditOf(t.channelUrl);
      if (sub) cacheKey = `reddit:${sub}`;
    }
    if (!cacheKey) continue;

    let upvotes = fetchCache.get(cacheKey);
    if (!upvotes) {
      if (fetches >= MAX_PUBLIC_FETCHES) continue;
      fetches += 1;
      upvotes =
        t.platform === "HACKERNEWS"
          ? await hnUpvotes(categoryQuery(t.productTag))
          : t.platform === "PRODUCTHUNT"
            ? await phUpvotes(categoryQuery(t.productTag))
            : await redditUpvotes(subredditOf(t.channelUrl)!);
      fetchCache.set(cacheKey, upvotes);
    }
    if (upvotes.length >= MIN_PUBLIC_SAMPLE) {
      out.set(`${t.productTag}::${t.channelId}`, {
        publicSample: upvotes.length,
        medianUpvotes: median(upvotes),
      });
    }
  }
  return out;
}

// ── Rollup (offline / cron) ────────────────────────────────
export type BenchmarkRollupSummary = { pairs: number; withPublic: boolean };

/**
 * Recompute ChannelBenchmark from first-party posts, optionally enriched with a
 * public-engagement bootstrap. Targets = every (category, channel) that either
 * has tracked posts OR appears in a ranked plan (so brand-new categories still
 * get a public number at the decision moment). Never throws to the caller.
 */
export async function rollupBenchmarks(
  opts: { withPublic?: boolean } = {},
): Promise<BenchmarkRollupSummary> {
  const tagCache = new Map<string, string>();
  const tagFor = (proj: { name: string; description: string | null; url: string | null }): string => {
    const key = `${proj.name}|${proj.url ?? ""}`;
    let tag = tagCache.get(key);
    if (!tag) {
      tag = productTagFor(`${proj.name} ${proj.description ?? ""} ${proj.url ?? ""}`);
      tagCache.set(key, tag);
    }
    return tag;
  };

  // 1) First-party per-post records.
  const posts = await db.post.findMany({
    include: {
      channel: { select: { id: true, platform: true, url: true } },
      ship: { include: { project: { select: { name: true, description: true, url: true } } } },
      trackedLink: { include: { events: { select: { type: true } } } },
    },
  });

  const records: PostRecord[] = [];
  const targets = new Map<string, BootstrapTarget>();
  for (const p of posts) {
    const tag = tagFor(p.ship.project);
    let signups = 0;
    let clicks = 0;
    for (const e of p.trackedLink?.events ?? []) {
      if (e.type === "CLICK") clicks += 1;
      else if (e.type === "SIGNUP") signups += 1;
    }
    records.push({ productTag: tag, channelId: p.channelId, signups, clicks });
    targets.set(`${tag}::${p.channelId}`, {
      productTag: tag,
      channelId: p.channelId,
      platform: p.channel.platform,
      channelUrl: p.channel.url,
    });
  }
  const agg = aggregateFirstParty(records);

  // 2) Cold-start targets: channels that appear in ranked plans but have no
  //    first-party posts yet — so a new category still gets a public number.
  const recs = await db.recommendation.findMany({
    include: {
      channel: { select: { id: true, platform: true, url: true } },
      plan: { include: { ship: { include: { project: { select: { name: true, description: true, url: true } } } } } },
    },
  });
  for (const r of recs) {
    const tag = tagFor(r.plan.ship.project);
    const key = `${tag}::${r.channelId}`;
    if (!targets.has(key)) {
      targets.set(key, {
        productTag: tag,
        channelId: r.channelId,
        platform: r.channel.platform,
        channelUrl: r.channel.url,
      });
    }
  }

  // 2b) Cold-start category coverage — only when we're actually going to hit the
  // network (withPublic). Guarantees every bucket has public targets (its top
  // HN/PH launch venues) even with no posts or plans yet. Skipped on the
  // request-path rollup, which stays first-party-only and fetch-free.
  if (opts.withPublic) {
    const catalog = await db.channel.findMany({
      select: {
        id: true,
        slug: true,
        platform: true,
        url: true,
        tags: true,
        defaultBanRisk: true,
      },
    });
    for (const t of coverageTargets(catalog)) {
      const key = `${t.productTag}::${t.channelId}`;
      if (!targets.has(key)) targets.set(key, t);
    }
  }

  // 3) Public bootstrap (best-effort).
  const publicMap = opts.withPublic
    ? await bootstrapPublic([...targets.values()]).catch(() => new Map())
    : new Map<string, { publicSample: number; medianUpvotes: number }>();

  // 4) Upsert one row per target (union of first-party + cold-start).
  const aggByKey = new Map<string, FirstPartyAgg>(
    agg.map((a) => [`${a.productTag}::${a.channelId}`, a]),
  );
  let pairs = 0;
  for (const [key, t] of targets) {
    const a = aggByKey.get(key);
    const pub = publicMap.get(key) ?? { publicSample: 0, medianUpvotes: 0 };
    const hasFirstParty = (a?.sampleSize ?? 0) >= MIN_FIRST_PARTY_POSTS;
    const hasPublic = pub.publicSample >= MIN_PUBLIC_SAMPLE;
    if (!hasFirstParty && !hasPublic) continue; // nothing worth storing

    const source: BenchmarkSource =
      hasFirstParty && hasPublic ? "blended" : hasFirstParty ? "first-party" : "public";

    await db.channelBenchmark.upsert({
      where: { productTag_channelId: { productTag: t.productTag, channelId: t.channelId } },
      create: {
        productTag: t.productTag,
        channelId: t.channelId,
        sampleSize: a?.sampleSize ?? 0,
        medianSignups: a?.medianSignups ?? 0,
        meanSignups: a?.meanSignups ?? 0,
        conversionPct: a?.conversionPct ?? 0,
        publicSample: pub.publicSample,
        medianUpvotes: pub.medianUpvotes,
        source,
      },
      update: {
        sampleSize: a?.sampleSize ?? 0,
        medianSignups: a?.medianSignups ?? 0,
        meanSignups: a?.meanSignups ?? 0,
        conversionPct: a?.conversionPct ?? 0,
        publicSample: pub.publicSample,
        medianUpvotes: pub.medianUpvotes,
        source,
      },
    });
    pairs += 1;
  }

  return { pairs, withPublic: Boolean(opts.withPublic) };
}
