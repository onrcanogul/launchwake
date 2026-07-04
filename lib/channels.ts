/**
 * Channel matching — the constraint layer.
 *
 * `matchChannels` narrows the seeded catalog to the candidates that actually fit
 * a given product + ship, BEFORE the LLM ranks them. This is deliberate: the LLM
 * may only rank/justify channels we hand it, so it can never invent a community
 * (which is how founders get banned). Pure + framework-agnostic → unit-testable.
 */

export type BanRiskLike = "LOW" | "MEDIUM" | "HIGH";

/** Structural subset of a Prisma Channel — keeps this module DB/framework free. */
export type ChannelLike = {
  id: string;
  slug: string;
  name: string;
  platform: string;
  audienceDesc?: string | null;
  rules?: string | null;
  defaultBanRisk: BanRiskLike;
  bestTime?: string | null;
  tags: string[];
};

export type MatchContext = {
  /** Product name + description + url. */
  projectText: string;
  /** Ship title + summary. */
  shipText: string;
  /** LAUNCH | FEATURE | BLOG | OTHER — nudges tag weighting. */
  shipType?: string;
  /**
   * First-launch context (Launch Mode). When true, launch-appropriate venues
   * (Product Hunt, Show HN, launch-friendly communities — tagged "launch") are
   * favored over evergreen channels.
   */
  launchContext?: boolean;
  /**
   * Real outcomes to fold into the fit score. When present, channels that have
   * driven signups for this project (or its category) rank up and repeated
   * zero-outcome channels decay — the moat made to bear on candidate selection.
   */
  outcomes?: OutcomeContext;
};

export type ScoredChannel<C extends ChannelLike = ChannelLike> = {
  channel: C;
  score: number;
  matchedTags: string[];
  /** Outcome-driven score delta folded into `score` (0 when no history). */
  outcomeDelta: number;
  /** Legible reason a rank moved because of real outcomes, or null. */
  outcomeReason: string | null;
};

/**
 * A channel's real, historical outcomes — first-party for THIS project. Same
 * shape as stats.ts `OutcomeSignal`; kept structural so this module stays
 * DB/framework free.
 */
export type ChannelOutcome = {
  posts: number;
  clicks: number;
  signups: number;
  removals: number;
};

/**
 * Category fallback for a channel, from ChannelBenchmark medians. Used only when
 * THIS project has no first-party history on the channel.
 */
export type ChannelBenchmarkSignal = {
  medianSignups: number;
  sampleSize: number;
};

/**
 * The outcome flywheel, at the candidate-selection layer: real results per
 * channel so a proven converter surfaces into the shortlist even with thin tag
 * overlap, and a channel that keeps getting traffic-with-no-signups (or removals)
 * decays out of it.
 */
export type OutcomeContext = {
  /** channelId → this project's own history (the strongest signal). */
  firstParty?: Map<string, ChannelOutcome>;
  /** channelId → category benchmark medians (fallback when no first-party). */
  benchmarks?: Map<string, ChannelBenchmarkSignal>;
};

/**
 * Keyword → fit-tag map. Left side is matched (word-boundary, case-insensitive)
 * against the combined project + ship text; right side are catalog tags.
 */
const KEYWORD_TAGS: Record<string, string[]> = {
  webhook: ["webhooks", "api", "backend", "devtools"],
  api: ["api", "backend", "devtools"],
  sdk: ["devtools", "developers", "api"],
  cli: ["devtools", "developers"],
  developer: ["developers", "devtools"],
  "dev tool": ["devtools", "developers"],
  devtool: ["devtools", "developers"],
  infra: ["infra", "devops", "backend"],
  infrastructure: ["infra", "devops", "backend"],
  devops: ["devops", "infra"],
  deploy: ["devops", "infra"],
  kubernetes: ["devops", "infra"],
  docker: ["devops", "infra", "selfhosted"],
  database: ["backend", "infra", "developers"],
  postgres: ["backend", "infra", "developers"],
  backend: ["backend", "developers"],
  frontend: ["frontend", "webdev"],
  react: ["frontend", "webdev", "javascript"],
  "next.js": ["frontend", "webdev", "javascript"],
  nextjs: ["frontend", "webdev", "javascript"],
  javascript: ["javascript", "webdev", "node"],
  typescript: ["javascript", "node", "developers"],
  node: ["node", "javascript", "backend"],
  web: ["webdev", "frontend"],
  security: ["security", "infra", "backend"],
  auth: ["security", "backend", "developers"],
  "open-source": ["opensource", "developers"],
  "open source": ["opensource", "developers"],
  opensource: ["opensource", "developers"],
  "self-host": ["selfhosted", "opensource", "infra"],
  "self host": ["selfhosted", "opensource", "infra"],
  selfhost: ["selfhosted", "opensource", "infra"],
  saas: ["saas", "b2b", "product"],
  b2b: ["b2b", "saas"],
  startup: ["startup", "founders"],
  founder: ["founders", "startup"],
  indie: ["indie", "founders", "makers"],
  ai: ["ai", "developers"],
  llm: ["ai", "developers"],
  testing: ["testing", "developers", "devtools"],
  monitor: ["devops", "infra", "backend"],
  observability: ["devops", "infra", "backend"],
  analytics: ["saas", "product", "b2b"],
  // Languages / frameworks — connect a product's stack to niche channels.
  rust: ["rust", "backend", "developers"],
  golang: ["golang", "backend", "developers"],
  python: ["python", "backend", "developers", "data"],
  django: ["django", "python", "backend", "webdev"],
  flask: ["python", "backend", "webdev"],
  ruby: ["ruby", "backend", "developers"],
  rails: ["rails", "ruby", "backend", "webdev"],
  php: ["php", "backend", "webdev"],
  laravel: ["laravel", "php", "backend", "webdev"],
  dotnet: ["dotnet", "csharp", "backend", "developers"],
  ".net": ["dotnet", "csharp", "backend"],
  csharp: ["csharp", "dotnet", "backend"],
  "c#": ["csharp", "dotnet", "backend"],
  java: ["java", "backend", "developers"],
  kotlin: ["kotlin", "android", "mobile"],
  swift: ["swift", "ios", "mobile"],
  ios: ["ios", "mobile", "swift"],
  android: ["android", "mobile", "kotlin"],
  flutter: ["flutter", "mobile", "developers"],
  elixir: ["elixir", "backend", "developers"],
  vue: ["vue", "frontend", "webdev", "javascript"],
  svelte: ["svelte", "frontend", "webdev", "javascript"],
  angular: ["angular", "frontend", "webdev", "javascript"],
  tailwind: ["css", "frontend", "webdev", "design"],
  mobile: ["mobile", "developers"],
  // Domains
  data: ["data", "backend", "developers"],
  "machine learning": ["ml", "ai", "data"],
  "data engineering": ["data", "infra", "backend"],
  game: ["gamedev", "developers"],
  gamedev: ["gamedev", "developers"],
  cloud: ["cloud", "infra", "devops"],
  aws: ["cloud", "aws", "devops", "infra"],
  serverless: ["cloud", "devops", "infra"],
  design: ["design", "product"],
  newsletter: ["newsletter", "writeup"],
};

const SHIP_TYPE_TAGS: Record<string, string[]> = {
  LAUNCH: ["launch", "product"],
  FEATURE: ["product", "devtools"],
  BLOG: ["blog", "writeup", "technical"],
  OTHER: [],
};

const BAN_RISK_ORDER: Record<BanRiskLike, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
};

/** Extract fit-tags implied by free text + ship type. */
export function deriveSignalTags(ctx: MatchContext): Set<string> {
  const haystack = `${ctx.projectText} ${ctx.shipText}`.toLowerCase();
  const tags = new Set<string>();

  for (const [keyword, mapped] of Object.entries(KEYWORD_TAGS)) {
    if (haystack.includes(keyword)) {
      mapped.forEach((t) => tags.add(t));
    }
  }

  // Every technical product gets a baseline developer signal so we never return
  // an empty candidate set for a real product.
  tags.add("developers");

  for (const t of SHIP_TYPE_TAGS[ctx.shipType ?? "OTHER"] ?? []) {
    tags.add(t);
  }

  // First-launch bias: treat launch/product as active signals so launch venues
  // enter (and rise within) the candidate set.
  if (ctx.launchContext) {
    tags.add("launch");
    tags.add("product");
  }

  return tags;
}

/** Extra score for launch-appropriate channels when in a first-launch context. */
const LAUNCH_TAG = "launch";
const LAUNCH_BOOST = 15;

// ── Outcome weighting (deterministic; on the same additive scale as tag overlap,
//    where one matched tag = 10 points) ──────────────────────
const OUTCOME_SIGNUP_MAX = 30; // cap on the up-weight from proven signups
const OUTCOME_DECAY_MAX = 22; // cap on the down-weight from no-convert traffic
const OUTCOME_BENCH_MAX = 12; // cap on the fallback up-weight from a category benchmark
const DECAY_MIN_CLICKS = 8; // "clear traffic but no signups" threshold
const DECAY_MIN_POSTS = 2; // "repeated zero-outcome posts" threshold

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export type OutcomeWeight = {
  /** score delta to fold into fit (positive = ranked up, negative = decayed). */
  delta: number;
  /** legible reason for the plan UI, or null when outcomes didn't move the rank. */
  reason: string | null;
  /** which way outcomes pushed the channel. */
  direction: "up" | "down" | null;
};

/**
 * Turn one channel's real history into a deterministic fit adjustment + a
 * legible reason. First-party (this project) is the strongest signal; a category
 * benchmark is the fallback when this project has never posted there. Pure.
 */
export function outcomeWeight(
  outcome: ChannelOutcome | undefined,
  benchmark: ChannelBenchmarkSignal | undefined,
): OutcomeWeight {
  // 1) First-party history for THIS project — the strongest, most specific signal.
  if (outcome && outcome.posts > 0) {
    const postStr = plural(outcome.posts, "post");
    let delta = 0;
    let reason: string | null = null;
    let direction: "up" | "down" | null = null;

    if (outcome.signups > 0) {
      delta = Math.min(OUTCOME_SIGNUP_MAX, 8 + outcome.signups * 2);
      direction = "up";
      const where =
        outcome.posts === 1 ? "your last post here" : `your ${postStr} here`;
      reason = `ranked up: ${plural(outcome.signups, "signup")} from ${where}`;
    } else if (outcome.posts >= DECAY_MIN_POSTS || outcome.clicks >= DECAY_MIN_CLICKS) {
      // Repeated posts (or clear traffic) but nothing converted → real decay.
      delta = -Math.min(OUTCOME_DECAY_MAX, 5 + Math.floor(outcome.clicks / 4) + outcome.posts);
      direction = "down";
      const detail =
        outcome.clicks > 0
          ? `${plural(outcome.clicks, "click")}, 0 signups across ${postStr}`
          : `0 signups across ${postStr}`;
      reason = `ranked down: ${detail} here`;
    }

    // Removals are their own negative signal, on top of the above.
    if (outcome.removals > 0) {
      delta -= Math.min(OUTCOME_DECAY_MAX, 4 + outcome.removals * 3);
      const removalNote = `${plural(outcome.removals, "removal")} here — post carefully`;
      reason = reason ? `${reason} · ${removalNote}` : `ranked down: ${removalNote}`;
    }

    if (delta !== 0) direction = delta > 0 ? "up" : "down";
    if (delta !== 0 || reason) return { delta, reason, direction };
  }

  // 2) Category benchmark fallback — only when this project has no history here.
  if (
    (!outcome || outcome.posts === 0) &&
    benchmark &&
    benchmark.sampleSize > 0 &&
    benchmark.medianSignups > 0
  ) {
    const delta = Math.min(OUTCOME_BENCH_MAX, benchmark.medianSignups);
    return {
      delta,
      direction: "up",
      reason: `ranked up: similar products see a median of ${plural(benchmark.medianSignups, "signup")} here`,
    };
  }

  return { delta: 0, reason: null, direction: null };
}

/**
 * Rank the catalog for this product + ship and return the top `limit` candidates.
 * Scoring = weighted tag overlap; ties broken by lower ban risk, then name.
 * Always returns something (falls back to lowest-ban-risk channels).
 */
export function matchChannels<C extends ChannelLike>(
  catalog: C[],
  ctx: MatchContext,
  limit = 12,
): ScoredChannel<C>[] {
  const signals = deriveSignalTags(ctx);

  const scored: ScoredChannel<C>[] = catalog.map((channel) => {
    const matchedTags = channel.tags.filter((t) => signals.has(t));
    // Overlap count is the core signal; tiny bonus for low ban risk so that,
    // all else equal, safer channels surface first. In a launch context, add a
    // deliberate boost so launch venues clear evergreen ones.
    const launchBoost =
      ctx.launchContext && channel.tags.includes(LAUNCH_TAG) ? LAUNCH_BOOST : 0;
    // The flywheel: fold real outcomes into the score so a proven channel can
    // clear the shortlist on weak tags, and a repeatedly-dead one decays out.
    const ow = ctx.outcomes
      ? outcomeWeight(
          ctx.outcomes.firstParty?.get(channel.id),
          ctx.outcomes.benchmarks?.get(channel.id),
        )
      : { delta: 0, reason: null, direction: null };
    const score =
      matchedTags.length * 10 -
      BAN_RISK_ORDER[channel.defaultBanRisk] +
      launchBoost +
      ow.delta;
    return {
      channel,
      score,
      matchedTags,
      outcomeDelta: ow.delta,
      outcomeReason: ow.reason,
    };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const risk =
      BAN_RISK_ORDER[a.channel.defaultBanRisk] -
      BAN_RISK_ORDER[b.channel.defaultBanRisk];
    if (risk !== 0) return risk;
    return a.channel.name.localeCompare(b.channel.name);
  });

  return scored.slice(0, limit);
}
