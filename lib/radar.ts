import { db } from "./db";
import { matchChannels } from "./channels";
import type { Project } from "@prisma/client";

/**
 * Launch radar — watch how products in the founder's category are launching on
 * Hacker News and Reddit (and Product Hunt if a token is set). "Your peer X got
 * 180 points on Show HN yesterday, went with this angle." Cheap: public APIs,
 * cached for an hour. Pure parsers/rankers are unit-tested; network is
 * best-effort and never throws to the caller.
 */

export type RadarSource = "HN" | "REDDIT" | "PRODUCTHUNT";

export type RadarItem = {
  source: RadarSource;
  title: string;
  url: string;
  points: number;
  comments: number | null;
  at: Date;
  /** The tagline/positioning pulled from the title, if any. */
  angle: string | null;
};

// Category terms we can both search for and rank relevance against.
const CATEGORY_TERMS = [
  "webhook", "api", "sdk", "cli", "devtools", "developer tools", "infrastructure",
  "kubernetes", "docker", "serverless", "database", "postgres", "backend",
  "frontend", "react", "next.js", "nextjs", "typescript", "javascript", "node",
  "python", "django", "rust", "golang", "ruby", "rails", "php", "laravel",
  "security", "auth", "observability", "monitoring", "analytics", "ai", "llm",
  "agents", "saas", "crm", "payments", "stripe", "open source", "open-source",
  "self-hosted", "self hosted", "no-code", "nocode", "automation", "email",
  "notifications", "search", "vector", "data", "etl", "graphql",
];

/** Concrete search terms for the project's category (from its own text). */
export function radarQueries(projectText: string): string[] {
  const t = projectText.toLowerCase();
  const hits = CATEGORY_TERMS.filter((term) => t.includes(term));
  // Prefer more specific (longer) terms; cap to keep API calls cheap.
  const ranked = [...new Set(hits)].sort((a, b) => b.length - a.length);
  return (ranked.length > 0 ? ranked : ["developer tools"]).slice(0, 3);
}

/** Pull the tagline/angle from a launch title. Pure. */
export function extractAngle(title: string): string | null {
  const cleaned = title.replace(/^show hn:\s*/i, "").trim();
  const m = cleaned.match(/[\s]([–—-]|:)\s+(.{6,140})$/);
  if (m) return m[2].trim().replace(/\s+/g, " ");
  return null;
}

// ── Pure parsers ───────────────────────────────────────────

type HnHit = {
  objectID: string;
  title: string | null;
  url: string | null;
  points: number | null;
  num_comments: number | null;
  created_at: string;
};

export function parseHnHits(json: unknown): RadarItem[] {
  const hits = (json as { hits?: HnHit[] })?.hits ?? [];
  return hits
    .filter((h) => h.title && Number.isFinite(Date.parse(h.created_at)))
    .map((h) => ({
      source: "HN" as const,
      title: h.title!,
      url: `https://news.ycombinator.com/item?id=${h.objectID}`,
      points: h.points ?? 0,
      comments: h.num_comments ?? null,
      at: new Date(h.created_at),
      angle: extractAngle(h.title!),
    }));
}

type RedditChild = {
  data?: {
    title?: string;
    permalink?: string;
    score?: number;
    num_comments?: number;
    created_utc?: number;
    stickied?: boolean;
  };
};

export function parseRedditListing(json: unknown): RadarItem[] {
  const children = (json as { data?: { children?: RedditChild[] } })?.data?.children ?? [];
  return children
    .map((c) => c.data)
    .filter((d): d is NonNullable<RedditChild["data"]> => Boolean(d?.title && d?.permalink && !d?.stickied))
    .map((d) => ({
      source: "REDDIT" as const,
      title: d.title!,
      url: `https://www.reddit.com${d.permalink}`,
      points: d.score ?? 0,
      comments: d.num_comments ?? null,
      at: new Date((d.created_utc ?? 0) * 1000),
      angle: extractAngle(d.title!),
    }));
}

/**
 * Rank + dedupe. HN items are already query-filtered by the API, so they're kept;
 * Reddit items (top-of-week) must match a category term to count. Sort by points.
 */
export function rankRadar(items: RadarItem[], queries: string[], limit = 8): RadarItem[] {
  const terms = queries.map((q) => q.toLowerCase());
  const relevant = items.filter((it) => {
    if (it.source === "HN") return true;
    const t = it.title.toLowerCase();
    return terms.some((term) => t.includes(term));
  });

  const seen = new Set<string>();
  const deduped = relevant.filter((it) => {
    const key = it.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().slice(0, 60);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return deduped.sort((a, b) => b.points - a.points).slice(0, limit);
}

// ── Digest text (for the weekly email — pure) ──────────────

export function buildRadarDigest(
  items: RadarItem[],
  projectName: string,
): { subject: string; text: string } | null {
  if (items.length === 0) return null;
  const subject = `Launch radar: ${items.length} launch${items.length === 1 ? "" : "es"} in ${projectName}'s space`;
  const lines = items.map((it) => {
    const angle = it.angle ? ` — angle: "${it.angle}"` : "";
    return `• [${it.source}] ${it.title} · ${it.points} pts${angle}\n  ${it.url}`;
  });
  const text = [
    `What launched in your category this week — learn from the angles that worked:`,
    "",
    ...lines,
    "",
    "— LaunchWake · watch competitors, borrow what converts.",
  ].join("\n");
  return { subject, text };
}

// ── Network (best-effort, cached 1h) ───────────────────────

const HN_API = "https://hn.algolia.com/api/v1/search";

async function fetchJson(url: string, init?: RequestInit): Promise<unknown | null> {
  try {
    const res = await fetch(url, {
      ...init,
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(6000),
      headers: { "User-Agent": "LaunchWake-Radar", ...(init?.headers ?? {}) },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function fetchHackerNews(queries: string[], sinceDays = 7): Promise<RadarItem[]> {
  const since = Math.floor((Date.now() - sinceDays * 86_400_000) / 1000);
  const out: RadarItem[] = [];
  for (const q of queries.slice(0, 2)) {
    const url = `${HN_API}?tags=show_hn&query=${encodeURIComponent(q)}&numericFilters=created_at_i>${since}&hitsPerPage=25`;
    const json = await fetchJson(url);
    if (json) out.push(...parseHnHits(json));
  }
  return out;
}

async function fetchReddit(subs: string[], sinceDays = 7): Promise<RadarItem[]> {
  void sinceDays; // reddit t=week already scopes it
  const out: RadarItem[] = [];
  for (const sub of subs.slice(0, 4)) {
    const json = await fetchJson(`https://www.reddit.com/r/${sub}/top.json?t=week&limit=20`);
    if (json) out.push(...parseRedditListing(json));
  }
  return out;
}

/** Subreddits relevant to this project, from the ranked catalog. */
async function relevantSubreddits(project: Pick<Project, "name" | "description" | "url">): Promise<string[]> {
  const catalog = await db.channel.findMany({ where: { platform: "REDDIT" } });
  const scored = matchChannels(
    catalog,
    {
      projectText: `${project.name} ${project.description ?? ""} ${project.url ?? ""}`,
      shipText: "",
      shipType: "OTHER",
    },
    4,
  );
  return scored
    .map((s) => s.channel.url?.match(/reddit\.com\/r\/([^/]+)/i)?.[1])
    .filter((x): x is string => Boolean(x));
}

/** The radar for a project — HN + Reddit launches in its category. Never throws. */
export async function getLaunchRadar(
  project: Pick<Project, "name" | "description" | "url">,
): Promise<RadarItem[]> {
  const queries = radarQueries(`${project.name} ${project.description ?? ""} ${project.url ?? ""}`);
  const subs = await relevantSubreddits(project).catch(() => []);
  const [hn, reddit] = await Promise.all([
    fetchHackerNews(queries).catch(() => []),
    fetchReddit(subs).catch(() => []),
  ]);
  return rankRadar([...hn, ...reddit], queries, 8);
}
