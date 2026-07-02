import { db } from "./db";
import type { IntentMatchStatus, IntentSource } from "@prisma/client";

/**
 * Read-model for the Intent Radar screen. Keeps Prisma out of the components:
 * loads a project's saved queries with their surfaced (non-dismissed) matches,
 * best-scoring first.
 */

export type IntentMatchView = {
  id: string;
  source: IntentSource;
  title: string;
  url: string;
  author: string | null;
  excerpt: string | null;
  score: number;
  matchReason: string | null;
  postedAt: Date;
  status: IntentMatchStatus;
  draftBody: string | null;
  safetyNote: string | null;
};

export type IntentQueryView = {
  id: string;
  title: string;
  phrases: string[];
  keywords: string[];
  subreddits: string[];
  active: boolean;
  matchCount: number;
  matches: IntentMatchView[];
};

const MATCHES_PER_QUERY = 25;

/** All Intent Radar queries for a project, each with its live matches. */
export async function listIntentQueries(projectId: string): Promise<IntentQueryView[]> {
  const queries = await db.intentQuery.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
    include: {
      matches: {
        where: { status: { not: "DISMISSED" } },
        orderBy: [{ score: "desc" }, { postedAt: "desc" }],
        take: MATCHES_PER_QUERY,
      },
      _count: { select: { matches: { where: { status: { not: "DISMISSED" } } } } },
    },
  });

  return queries.map((q) => ({
    id: q.id,
    title: q.title,
    phrases: q.phrases,
    keywords: q.keywords,
    subreddits: q.subreddits,
    active: q.active,
    matchCount: q._count.matches,
    matches: q.matches.map((m) => ({
      id: m.id,
      source: m.source,
      title: m.title,
      url: m.url,
      author: m.author,
      excerpt: m.excerpt,
      score: m.score,
      matchReason: m.matchReason,
      postedAt: m.postedAt,
      status: m.status,
      draftBody: m.draftBody,
      safetyNote: m.safetyNote,
    })),
  }));
}

/** Verify a query belongs to an account (owner scope) and return its projectId. */
export async function assertQueryOwned(queryId: string, accountId: string): Promise<string> {
  const q = await db.intentQuery.findFirst({
    where: { id: queryId, project: { userId: accountId } },
    select: { id: true, projectId: true },
  });
  if (!q) throw new Error("Query not found.");
  return q.projectId;
}

/** Verify a match belongs to an account (owner scope). */
export async function assertMatchOwned(matchId: string, accountId: string): Promise<void> {
  const m = await db.intentMatch.findFirst({
    where: { id: matchId, query: { project: { userId: accountId } } },
    select: { id: true },
  });
  if (!m) throw new Error("Match not found.");
}
