import { db } from "./db";

/**
 * Durable per-user daily LLM token spend.
 *
 * Replaces the in-memory Map that reset on every deploy/cold-start and never
 * held across serverless instances (so a scripted caller could blow past the
 * budget by hitting different lambdas). Backed by the `LlmUsageDay` table; the
 * increment is atomic, so concurrent requests can't lose spend.
 */

/** UTC calendar day, "YYYY-MM-DD". Injectable clock for tests. */
export function utcDay(now: number = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

/** Pure budget decision — spend at or above the cap is over budget. */
export function isOverBudget(spent: number, limit: number): boolean {
  return spent >= limit;
}

/** Tokens spent by a user today (UTC), 0 if none. */
export async function usageForDay(
  userId: string,
  day: string = utcDay(),
): Promise<number> {
  const row = await db.llmUsageDay.findUnique({
    where: { userId_day: { userId, day } },
  });
  return row?.tokens ?? 0;
}

/** Atomically add `tokens` to a user's spend for today (UTC). No-op for ≤0. */
export async function recordUsage(
  userId: string,
  tokens: number,
  day: string = utcDay(),
): Promise<void> {
  if (tokens <= 0) return;
  await db.llmUsageDay.upsert({
    where: { userId_day: { userId, day } },
    create: { userId, day, tokens },
    update: { tokens: { increment: tokens } },
  });
}
