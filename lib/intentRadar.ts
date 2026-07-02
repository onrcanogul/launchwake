import { z } from "zod";
import { db } from "./db";
import { completeJSON, llmConfigured } from "./llm";
import type { IntentQuery, Project } from "@prisma/client";

/**
 * Intent Radar — "people looking for your product".
 *
 * Launches end; conversations don't. This watches Hacker News (Ask HN + comments)
 * and Reddit for posts/comments where someone is *asking* for a tool like the
 * founder's ("is there a tool that tracks which channel drove signups?",
 * "alternative to X?"). Each hit becomes a warm lead with a ban-safe, human-
 * written draft reply the founder posts themselves — we never auto-post.
 *
 * Same shape as lib/radar.ts: pure parsers/scorers are unit-tested; the network
 * is best-effort, cached, and never throws to the caller.
 */

export type IntentSourceKind = "HN" | "REDDIT";

/** A raw candidate pulled from a source, before scoring. */
export type IntentCandidate = {
  source: IntentSourceKind;
  /** Stable source id (HN objectID / Reddit fullname) — dedupes ingest. */
  externalId: string;
  title: string;
  url: string;
  author: string | null;
  /** Full text we scored against (post body / comment / title). */
  text: string;
  at: Date;
};

/** A candidate that cleared the bar, with its relevance score + why. */
export type ScoredIntent = {
  candidate: IntentCandidate;
  score: number; // 0..100
  reason: string;
};

// Generic "I'm looking for something" signals (not the user's own phrases).
const INTENT_SIGNALS = [
  "looking for",
  "is there a",
  "is there any",
  "anyone know",
  "anyone using",
  "any recommendation",
  "recommendations",
  "recommend",
  "alternative to",
  "alternatives to",
  "suggestions",
  "what do you use",
  "what are you using",
  "how do you track",
  "need a tool",
  "tool that",
  "tool for",
  "tool to",
  "which tool",
  "best tool",
  "any tool",
  "does anyone",
];

// Self-promotion / launch posts — the opposite of intent. Someone showing off
// their own thing is not a lead; down-weight hard so we don't surface them.
const SELF_PROMO = [
  "i built",
  "i made",
  "i created",
  "i've built",
  "i have built",
  "i just launched",
  "i launched",
  "check out my",
  "show hn:",
  "[showcase]",
  "my new",
  "we built",
  "we launched",
  "we made",
  "introducing",
  "launching",
];

const norm = (s: string): string => s.toLowerCase().replace(/\s+/g, " ");

/** Count how many needles appear in the (already-normalized) haystack. */
function countHits(haystack: string, needles: string[]): number {
  let n = 0;
  for (const needle of needles) {
    if (needle && haystack.includes(needle.toLowerCase())) n += 1;
  }
  return n;
}

/**
 * Score a candidate 0..100 for how much it looks like someone asking for the
 * user's product, or null if it doesn't clear the bar. Pure → unit-testable.
 *
 * Gate: must mention a topic keyword AND show some intent (a user phrase or a
 * generic looking-for signal). A keyword mention alone isn't a lead.
 */
export function scoreIntent(
  candidate: Pick<IntentCandidate, "title" | "text" | "at">,
  query: Pick<IntentQuery, "phrases" | "keywords">,
  now: Date = new Date(),
): { score: number; reason: string } | null {
  const hay = norm(`${candidate.title} ${candidate.text}`);

  const keywordHits = countHits(hay, query.keywords);
  if (keywordHits === 0) return null; // off-topic

  const phraseHits = countHits(hay, query.phrases);
  const signalHits = countHits(hay, INTENT_SIGNALS);
  const hasQuestion = hay.includes("?");
  const promoHits = countHits(hay, SELF_PROMO);

  // Needs some expressed intent, not just a topical mention.
  if (phraseHits === 0 && signalHits === 0 && !hasQuestion) return null;

  let score = 20; // cleared the topical gate
  score += Math.min(phraseHits, 2) * 22; // the founder's own phrases are strongest
  score += Math.min(signalHits, 3) * 8;
  if (hasQuestion) score += 8;
  score += Math.min(keywordHits, 2) * 4;

  // Recency: fresh conversations are actionable; stale ones have moved on.
  const ageDays = (now.getTime() - candidate.at.getTime()) / 86_400_000;
  if (ageDays <= 1) score += 10;
  else if (ageDays <= 3) score += 6;
  else if (ageDays <= 7) score += 3;

  // Someone promoting their own tool is not a lead.
  score -= promoHits * 40;

  score = Math.max(0, Math.min(100, Math.round(score)));
  if (score < 30) return null;

  const bits: string[] = [];
  if (phraseHits > 0) bits.push("matched your intent phrase");
  else if (signalHits > 0 || hasQuestion) bits.push("someone asking for a tool");
  const kw = query.keywords.find((k) => hay.includes(k.toLowerCase()));
  if (kw) bits.push(`about "${kw}"`);
  if (ageDays <= 1) bits.push("posted today");

  return { score, reason: bits.join(" · ") || "topical + intent signal" };
}

/** A short excerpt of the matched text for the feed. Pure. */
export function excerptOf(text: string, max = 240): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

// ── Pure parsers ───────────────────────────────────────────

type HnHit = {
  objectID: string;
  title?: string | null;
  url?: string | null;
  story_title?: string | null;
  story_text?: string | null;
  comment_text?: string | null;
  author?: string | null;
  created_at?: string | null;
  _tags?: string[];
};

/** Parse a Hacker News Algolia search response into candidates. Pure. */
export function parseHnIntent(json: unknown): IntentCandidate[] {
  const hits = (json as { hits?: HnHit[] })?.hits ?? [];
  const out: IntentCandidate[] = [];
  for (const h of hits) {
    if (!h.objectID || !h.created_at || !Number.isFinite(Date.parse(h.created_at)))
      continue;
    const isComment = Boolean(h.comment_text);
    const body = h.comment_text ?? h.story_text ?? "";
    const title = isComment
      ? h.story_title
        ? `Comment on “${h.story_title}”`
        : "Hacker News comment"
      : h.title ?? h.story_title ?? "Hacker News post";
    const text = `${!isComment ? h.title ?? "" : ""} ${body}`.trim();
    if (!text) continue;
    out.push({
      source: "HN",
      externalId: `hn_${h.objectID}`,
      title,
      url: `https://news.ycombinator.com/item?id=${h.objectID}`,
      author: h.author ?? null,
      text,
      at: new Date(h.created_at),
    });
  }
  return out;
}

type RedditChild = {
  kind?: string;
  data?: {
    name?: string; // fullname, e.g. "t3_abc123"
    title?: string;
    selftext?: string;
    permalink?: string;
    author?: string;
    created_utc?: number;
    stickied?: boolean;
    over_18?: boolean;
  };
};

/** Parse a Reddit search/listing response into candidates. Pure. */
export function parseRedditIntent(json: unknown): IntentCandidate[] {
  const children = (json as { data?: { children?: RedditChild[] } })?.data?.children ?? [];
  const out: IntentCandidate[] = [];
  for (const c of children) {
    const d = c.data;
    if (!d?.title || !d.permalink || d.stickied) continue;
    const text = `${d.title} ${d.selftext ?? ""}`.trim();
    out.push({
      source: "REDDIT",
      externalId: d.name ?? `reddit_${d.permalink}`,
      title: d.title,
      url: `https://www.reddit.com${d.permalink}`,
      author: d.author ?? null,
      text,
      at: new Date((d.created_utc ?? 0) * 1000),
    });
  }
  return out;
}

/**
 * Score, gate, and dedupe candidates for one query. Pure → unit-testable.
 * Best score wins on duplicate URLs; returns highest-scoring first.
 */
export function rankIntent(
  candidates: IntentCandidate[],
  query: Pick<IntentQuery, "phrases" | "keywords">,
  now: Date = new Date(),
  limit = 25,
): ScoredIntent[] {
  const byId = new Map<string, ScoredIntent>();
  for (const candidate of candidates) {
    const scored = scoreIntent(candidate, query, now);
    if (!scored) continue;
    const prev = byId.get(candidate.externalId);
    if (!prev || scored.score > prev.score) {
      byId.set(candidate.externalId, { candidate, score: scored.score, reason: scored.reason });
    }
  }
  return [...byId.values()].sort((a, b) => b.score - a.score).slice(0, limit);
}

// ── Network (best-effort, cached 30m) ──────────────────────

const HN_API = "https://hn.algolia.com/api/v1/search";

async function fetchJson(url: string, init?: RequestInit): Promise<unknown | null> {
  try {
    const res = await fetch(url, {
      ...init,
      next: { revalidate: 1800 },
      signal: AbortSignal.timeout(6000),
      headers: { "User-Agent": "LaunchWake-IntentRadar", ...(init?.headers ?? {}) },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Distinct search terms for the source APIs: user phrases + keywords. */
export function searchTerms(query: Pick<IntentQuery, "phrases" | "keywords">): string[] {
  const terms = [...query.phrases, ...query.keywords]
    .map((t) => t.trim())
    .filter((t) => t.length >= 3);
  return [...new Set(terms.map((t) => t.toLowerCase()))].slice(0, 4);
}

async function fetchHnIntent(terms: string[], sinceDays = 14): Promise<IntentCandidate[]> {
  const since = Math.floor((Date.now() - sinceDays * 86_400_000) / 1000);
  const out: IntentCandidate[] = [];
  for (const term of terms.slice(0, 3)) {
    const url = `${HN_API}?query=${encodeURIComponent(term)}&tags=(story,comment)&numericFilters=created_at_i>${since}&hitsPerPage=25`;
    const json = await fetchJson(url);
    if (json) out.push(...parseHnIntent(json));
  }
  return out;
}

async function fetchRedditIntent(
  terms: string[],
  subreddits: string[],
): Promise<IntentCandidate[]> {
  const out: IntentCandidate[] = [];
  const q = encodeURIComponent(terms.slice(0, 3).join(" OR "));
  if (subreddits.length > 0) {
    for (const sub of subreddits.slice(0, 4)) {
      const url = `https://www.reddit.com/r/${encodeURIComponent(sub)}/search.json?q=${q}&restrict_sr=1&sort=new&t=month&limit=25`;
      const json = await fetchJson(url);
      if (json) out.push(...parseRedditIntent(json));
    }
  } else {
    const url = `https://www.reddit.com/search.json?q=${q}&sort=new&t=month&limit=25`;
    const json = await fetchJson(url);
    if (json) out.push(...parseRedditIntent(json));
  }
  return out;
}

/** Find + rank fresh intent matches for a query. Never throws. */
export async function findIntentMatches(
  query: Pick<IntentQuery, "phrases" | "keywords" | "subreddits">,
  now: Date = new Date(),
): Promise<ScoredIntent[]> {
  const terms = searchTerms(query);
  if (terms.length === 0) return [];
  const [hn, reddit] = await Promise.all([
    fetchHnIntent(terms).catch(() => []),
    fetchRedditIntent(terms, query.subreddits).catch(() => []),
  ]);
  return rankIntent([...hn, ...reddit], query, now);
}

/**
 * Persist newly-seen matches for a query (idempotent via @@unique[queryId,
 * externalId]). Returns the rows that were actually inserted so the caller can
 * generate drafts + notify only for genuinely new conversations.
 */
export async function ingestMatches(
  queryId: string,
  scored: ScoredIntent[],
): Promise<{ id: string; score: number }[]> {
  if (scored.length === 0) return [];

  const existing = await db.intentMatch.findMany({
    where: { queryId, externalId: { in: scored.map((s) => s.candidate.externalId) } },
    select: { externalId: true },
  });
  const seen = new Set(existing.map((e) => e.externalId));
  const fresh = scored.filter((s) => !seen.has(s.candidate.externalId));
  if (fresh.length === 0) return [];

  const created: { id: string; score: number }[] = [];
  for (const s of fresh) {
    try {
      const row = await db.intentMatch.create({
        data: {
          queryId,
          source: s.candidate.source,
          externalId: s.candidate.externalId,
          title: s.candidate.title.slice(0, 300),
          url: s.candidate.url,
          author: s.candidate.author,
          excerpt: excerptOf(s.candidate.text),
          score: s.score,
          matchReason: s.reason,
          postedAt: s.candidate.at,
        },
        select: { id: true, score: true },
      });
      created.push(row);
    } catch (err) {
      // P2002 = concurrent insert of the same match → skip.
      if ((err as { code?: string }).code !== "P2002") throw err;
    }
  }
  return created;
}

/** Alert copy when new intent matches land (email + Slack). Pure. */
export function buildIntentAlert(
  queryTitle: string,
  count: number,
  appUrl: string,
): { subject: string; text: string } {
  const base = appUrl.replace(/\/$/, "");
  const subject = `Intent Radar: ${count} new ${count === 1 ? "person is" : "people are"} asking for your product`;
  const text = [
    `${count} new conversation${count === 1 ? "" : "s"} matched "${queryTitle}".`,
    `Someone is describing a need your product fills — reply while it's warm.`,
    "",
    `Review + copy a ban-safe draft reply → ${base}/app/radar`,
    "",
    "— LaunchWake · Launches end. Conversations don't.",
  ].join("\n");
  return { subject, text };
}

// ── Draft reply (LLM) — ban-safe, human posts it themselves ─────────────────

const ReplySchema = z.object({
  body: z.string().min(1).max(1200),
  safetyNote: z.string().max(280).nullish(),
});
export type ReplyResult = z.infer<typeof ReplySchema>;

export type ReplyContext = {
  project: Pick<Project, "name" | "description" | "url">;
  match: { source: IntentSourceKind; title: string; excerpt: string | null };
};

/** System + user prompt for a helpful, non-spammy reply. Pure → unit-testable. */
export function buildReplyPrompt(ctx: ReplyContext) {
  const system = [
    "You draft a reply for a technical founder to a stranger who is asking for a tool like theirs.",
    "The founder will read, edit, and post this reply THEMSELVES — you never post. Write in their first-person voice.",
    "Rules that keep it from getting flagged as spam:",
    "- Answer their actual question first and genuinely. Be useful even if they never click.",
    "- Disclose you're the maker in one honest clause ('I build X' / 'disclosure: I work on X').",
    "- Mention the product once, as an option, not a pitch. No hype, no emoji, no fake metrics.",
    "- Only include a link if it genuinely helps; otherwise let them ask. Never more than one link.",
    ctx.match.source === "HN"
      ? "This is Hacker News: understated, technical, substance over marketing."
      : "This is Reddit: value-first (90/10 rule); a hard sell gets removed and can ban the account.",
    "Keep it under ~120 words.",
    'Respond with ONLY a JSON object: {"body":string,"safetyNote":string}. safetyNote is one line on how to post this without getting flagged.',
  ].join("\n");

  const prompt = [
    `Product: ${ctx.project.name}${ctx.project.url ? ` (${ctx.project.url})` : ""}`,
    ctx.project.description ? `What it does: ${ctx.project.description}` : "",
    "",
    `They posted on ${ctx.match.source}:`,
    `Title: ${ctx.match.title}`,
    ctx.match.excerpt ? `Text: ${ctx.match.excerpt}` : "",
    "",
    "Write the reply now.",
  ]
    .filter(Boolean)
    .join("\n");

  return { system, prompt };
}

/** Offline template so replies work without an API key. Pure. */
export function heuristicReply(ctx: ReplyContext): ReplyResult {
  const { project, match } = ctx;
  const link = project.url ? ` (${project.url})` : "";
  const body = [
    `Depends what you're optimizing for, but a few options exist here.`,
    `Full disclosure — I build ${project.name}${link}, which${project.description ? ` ${lowerFirst(project.description)}` : " does exactly this"}.`,
    match.source === "REDDIT"
      ? `Happy to explain the approach even if it's not the right fit for you.`
      : `Happy to go into the technical details if useful.`,
  ].join(" ");
  return {
    body,
    safetyNote:
      match.source === "REDDIT"
        ? "Lead with genuine help; keep the self-mention brief so it isn't removed as spam."
        : "Keep it understated and disclose you're the maker — HN dislikes marketing.",
  };
}

function lowerFirst(s: string): string {
  return s ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

/**
 * Generate (and persist) a ban-safe draft reply for one match. Idempotent:
 * re-running overwrites the stored draft. Returns the reply text.
 */
export async function generateIntentReply(matchId: string): Promise<ReplyResult> {
  const match = await db.intentMatch.findUnique({
    where: { id: matchId },
    include: { query: { include: { project: true } } },
  });
  if (!match) throw new Error(`IntentMatch ${matchId} not found`);

  const project = match.query.project;
  const ctx: ReplyContext = {
    project,
    match: {
      source: match.source === "HN" ? "HN" : "REDDIT",
      title: match.title,
      excerpt: match.excerpt,
    },
  };

  const prompt = buildReplyPrompt(ctx);
  const result = llmConfigured()
    ? await completeJSON({
        userId: project.userId,
        system: prompt.system,
        prompt: prompt.prompt,
        schema: ReplySchema,
        label: `intent-reply:${match.source}`,
        maxTokens: 700,
      })
    : heuristicReply(ctx);

  await db.intentMatch.update({
    where: { id: matchId },
    data: { draftBody: result.body, safetyNote: result.safetyNote ?? null },
  });
  return result;
}
