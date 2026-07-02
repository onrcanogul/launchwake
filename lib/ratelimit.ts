/**
 * Tiny in-memory rate limiter for the public (login-less) lead-magnet endpoints.
 *
 * A fixed-window counter keyed by an arbitrary string (usually the caller IP).
 * In-process only — resets on deploy and is per-instance — which is fine for a
 * cheap abuse guard on a low-cost tool. If we ever need durable/global limits,
 * swap the Map for Redis behind the same signature. Pure + injectable clock →
 * unit-testable.
 */

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

/** Test helper — clear all buckets. */
export function __resetRateLimit(): void {
  buckets.clear();
}
