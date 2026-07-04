import type { RateLimitResult } from "./ratelimit";

/**
 * Magic-link (email sign-in) send limits. The email flow can be abused to burn
 * SMTP quota or spam arbitrary inboxes, so a send must clear BOTH:
 *   - 3 per email address per 15 minutes, AND
 *   - 10 per IP per hour.
 *
 * The limits and key derivation live here (pure, unit-tested); the login gate
 * wires them to the durable, cross-instance limiter.
 */
export const MAGIC_LINK_LIMITS = {
  email: { limit: 3, windowMs: 15 * 60_000 },
  ip: { limit: 10, windowMs: 60 * 60_000 },
} as const;

export function magicLinkEmailKey(email: string): string {
  return `magiclink:email:${email}`;
}

export function magicLinkIpKey(ip: string): string {
  return `magiclink:ip:${ip}`;
}

/** A fixed-window limiter (in-memory `rateLimit` or durable `rateLimitDurable`). */
type Limiter = (
  key: string,
  limit: number,
  windowMs: number,
  now?: number,
) => RateLimitResult | Promise<RateLimitResult>;

/**
 * Record one send attempt and report whether it's allowed. Both buckets are
 * always hit (so a hammering email also spends the IP budget) and BOTH must be
 * within budget. `email` must already be normalized by the caller. `now` is
 * injectable for tests.
 */
export async function evaluateMagicLinkLimit(
  email: string,
  ip: string,
  limiter: Limiter,
  now?: number,
): Promise<boolean> {
  const emailResult = await limiter(
    magicLinkEmailKey(email),
    MAGIC_LINK_LIMITS.email.limit,
    MAGIC_LINK_LIMITS.email.windowMs,
    now,
  );
  const ipResult = await limiter(
    magicLinkIpKey(ip),
    MAGIC_LINK_LIMITS.ip.limit,
    MAGIC_LINK_LIMITS.ip.windowMs,
    now,
  );
  return emailResult.ok && ipResult.ok;
}
