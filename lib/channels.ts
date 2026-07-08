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
  /** Raw seeded cost JSON ({ type, note? }); parsed by lib/channelCost. */
  cost?: unknown;
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
};

export type ScoredChannel<C extends ChannelLike = ChannelLike> = {
  channel: C;
  score: number;
  matchedTags: string[];
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
    const score =
      matchedTags.length * 10 - BAN_RISK_ORDER[channel.defaultBanRisk] + launchBoost;
    return { channel, score, matchedTags };
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
