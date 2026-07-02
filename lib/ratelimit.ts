/**
 * Fixed-window rate limiter for the public (login-less) endpoints.
 *
 * Two implementations behind one result shape:
 *  - `rateLimit`        — pure, in-memory, injectable clock (unit-testable).
 *  - `rateLimitDurable` — DB-backed, atomic, shared across serverless instances.
 *    Use this in routes: on Vercel every request may hit a fresh lambda, so the
 *    in-memory Map resets constantly and a scripted caller sails past it.
 */

import { db } from "./db";

export type RateLimitResult = {
  ok: boolean;
  /** Requests left in the current window (0 when blocked). */
  remaining: number;
  /** Epoch ms when the current window resets. */
  resetAt: number;
};

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/**
 * Record one hit for `key` and report whether it's within `limit` per
 * `windowMs`. `now` is injectable for tests.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): RateLimitResult {
  const existing = buckets.get(key);

  if (!existing || now >= existing.resetAt) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { ok: true, remaining: limit - 1, resetAt };
  }

  if (existing.count >= limit) {
    return { ok: false, remaining: 0, resetAt: existing.resetAt };
  }

  existing.count += 1;
  return {
    ok: true,
    remaining: limit - existing.count,
    resetAt: existing.resetAt,
  };
}

/** Best-effort client IP from proxy headers; falls back to a shared bucket. */
export function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return headers.get("x-real-ip")?.trim() || "unknown";
}

/** Pure: the fixed window a timestamp falls into. Exposed for testing. */
export function windowBounds(
  now: number,
  windowMs: number,
): { startMs: number; resetAt: number } {
  const startMs = Math.floor(now / windowMs) * windowMs;
  return { startMs, resetAt: startMs + windowMs };
}

/**
 * Durable fixed-window limit. One atomic SQL upsert per hit — the ON CONFLICT
 * increment is race-safe, so concurrent requests across instances share one
 * counter. Keyed per window, so windows never overlap and old rows just go
 * stale (prune later by resetAt). Fails OPEN on a DB error: a rate limiter must
 * never take the endpoint down.
 */
export async function rateLimitDurable(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): Promise<RateLimitResult> {
  const { startMs, resetAt } = windowBounds(now, windowMs);
  const id = `${key}:${startMs}`;
  try {
    const rows = await db.$queryRaw<{ count: number }[]>`
      INSERT INTO "RateWindow" ("id", "count", "resetAt")
      VALUES (${id}, 1, ${new Date(resetAt)})
      ON CONFLICT ("id") DO UPDATE SET "count" = "RateWindow"."count" + 1
      RETURNING "count"
    `;
    const count = Number(rows[0]?.count ?? 1);
    return { ok: count <= limit, remaining: Math.max(0, limit - count), resetAt };
  } catch (err) {
    console.error("[ratelimit] durable check failed, allowing:", err);
    return { ok: true, remaining: limit, resetAt };
  }
}

/** Test helper — clear all buckets. */
export function __resetRateLimit(): void {
  buckets.clear();
}
