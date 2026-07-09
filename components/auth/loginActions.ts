"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { clientIp, rateLimitDurable } from "@/lib/ratelimit";
import { evaluateMagicLinkLimit } from "@/lib/magicLink";
import {
  stashSignupSourceByEmail,
  stashSignupSourceCookie,
} from "@/lib/signupSource";
import { MAX_ANSWER_LEN } from "@/lib/selfReport";

/**
 * Gate a magic-link email send BEFORE Auth.js is invoked. The LoginForm calls
 * this first; only on `{ ok: true }` does it actually trigger
 * signIn("nodemailer"). This rate-limits the flow (3/email/15min, 10/IP/hour)
 * so it can't be used to burn SMTP quota or spam arbitrary inboxes.
 *
 * Privacy: a rate-limited request returns `reason: "limited"`, which the UI
 * renders identically to a successful send — it never reveals whether the
 * address is registered, nor distinguishes rate-limit from success in the copy.
 */
export type MagicLinkGate =
  | { ok: true }
  | { ok: false; reason: "invalid" | "limited" };

const EmailSchema = z.string().trim().toLowerCase().email().max(254);
const HeardSchema = z.string().trim().max(MAX_ANSWER_LEN).optional();

export async function requestMagicLink(
  email: string,
  heardVia?: string,
): Promise<MagicLinkGate> {
  const parsed = EmailSchema.safeParse(email);
  if (!parsed.success) return { ok: false, reason: "invalid" };

  const ip = clientIp(await headers());
  const allowed = await evaluateMagicLinkLimit(parsed.data, ip, rateLimitDurable);
  if (!allowed) return { ok: false, reason: "limited" };

  // About to send the link — stash the self-reported source keyed by email so we
  // can stamp it on the User when they land back (survives a cross-device click).
  const heard = HeardSchema.safeParse(heardVia);
  if (heard.success && heard.data) {
    await stashSignupSourceByEmail(parsed.data, heard.data).catch(() => {});
  }
  return { ok: true };
}

/**
 * GitHub flow: no email pre-auth, so stash the "how did you hear about us?"
 * answer in a short-lived cookie that rides the OAuth redirect back to us. The
 * LoginForm awaits this before calling signIn("github").
 */
export async function stashSignupSource(heardVia: string): Promise<void> {
  const heard = HeardSchema.safeParse(heardVia);
  if (heard.success && heard.data) {
    await stashSignupSourceCookie(heard.data).catch(() => {});
  }
}
