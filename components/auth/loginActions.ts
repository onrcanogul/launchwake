"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { clientIp, rateLimitDurable } from "@/lib/ratelimit";
import { evaluateMagicLinkLimit } from "@/lib/magicLink";

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

export async function requestMagicLink(email: string): Promise<MagicLinkGate> {
  const parsed = EmailSchema.safeParse(email);
  if (!parsed.success) return { ok: false, reason: "invalid" };

  const ip = clientIp(await headers());
  const allowed = await evaluateMagicLinkLimit(parsed.data, ip, rateLimitDurable);
  return allowed ? { ok: true } : { ok: false, reason: "limited" };
}
