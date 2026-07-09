/**
 * LaunchWake dogfooding its own dark-social attribution: capturing "how did you
 * hear about us?" on our OWN signup — the funnel where a tracked link/UTM would
 * miss the podcast, DM, or word-of-mouth that actually drove the account.
 *
 * The answer is given on the /login form BEFORE auth completes, but the User row
 * is only created on the round-trip back (magic-link click / GitHub callback).
 * Two persistence paths bridge that gap, each fit for its flow:
 *   - magic link  → stash keyed by EMAIL (survives a cross-device click), and
 *   - GitHub      → stash in a short-lived cookie (no email pre-auth; same
 *                   device through the OAuth redirect).
 * On createUser we `claim` whichever is present and stamp it on the User.
 */

import { cookies } from "next/headers";
import { db } from "./db";
import { normalizeSource, MAX_ANSWER_LEN } from "./selfReport";

/** Cookie carrying the answer through the GitHub OAuth round-trip. */
export const SIGNUP_SOURCE_COOKIE = "lw_heard";
/** Lead.source marker for an email-keyed pending signup answer. */
export const SIGNUP_LEAD_SOURCE = "signup-heard";
const COOKIE_MAX_AGE_S = 30 * 60;

function clean(answer: string | null | undefined): string {
  return (answer ?? "").trim().slice(0, MAX_ANSWER_LEN);
}

/**
 * Resolve a raw pending answer to a normalized source key, or null. Pure —
 * unit-tested; `claimSignupSource` wraps it with the cookie/db lookups.
 */
export function resolveHeardVia(answer: string | null | undefined): string | null {
  const a = clean(answer);
  if (!a) return null;
  return normalizeSource(a).source;
}

/** Magic-link flow: stash the answer keyed by email (cross-device safe). */
export async function stashSignupSourceByEmail(
  email: string,
  answer: string | null | undefined,
): Promise<void> {
  const a = clean(answer);
  if (!a) return;
  await db.lead.create({
    data: {
      email: email.toLowerCase().trim(),
      source: SIGNUP_LEAD_SOURCE,
      context: { answer: a, source: normalizeSource(a).source },
    },
  });
}

/** GitHub flow: stash the answer in a short-lived httpOnly cookie. */
export async function stashSignupSourceCookie(
  answer: string | null | undefined,
): Promise<void> {
  const a = clean(answer);
  const jar = await cookies();
  if (!a) return;
  jar.set(SIGNUP_SOURCE_COOKIE, a, {
    maxAge: COOKIE_MAX_AGE_S,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}

/**
 * Claim the pending answer for a just-created user (email-keyed Lead first, then
 * the cookie) and return its normalized source key, or null. Read-only w.r.t.
 * cookies (createUser can't reliably mutate them); the cookie's short TTL and a
 * harmless stale Lead handle cleanup.
 */
export async function claimSignupSource(email: string): Promise<string | null> {
  const lead = await db.lead.findFirst({
    where: { email: email.toLowerCase().trim(), source: SIGNUP_LEAD_SOURCE },
    orderBy: { createdAt: "desc" },
    select: { context: true },
  });
  const leadAnswer =
    lead && typeof lead.context === "object" && lead.context !== null
      ? (lead.context as { answer?: unknown }).answer
      : undefined;
  if (typeof leadAnswer === "string") {
    const source = resolveHeardVia(leadAnswer);
    if (source) return source;
  }

  const jar = await cookies();
  return resolveHeardVia(jar.get(SIGNUP_SOURCE_COOKIE)?.value ?? null);
}

/** Stamp the normalized source on the user (called once at account creation). */
export async function attachHeardVia(userId: string, source: string): Promise<void> {
  await db.user.update({
    where: { id: userId },
    data: { heardVia: source, heardViaAt: new Date() },
  });
}
