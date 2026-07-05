import { createHmac, timingSafeEqual } from "crypto";
import { db } from "./db";
import { env } from "./env";

/**
 * Email preferences — one boolean (`User.emailNotifications`, default on) that
 * gates every product-notification email (weekly digest, plan-ready). Auth
 * magic links are transactional and never gated by it.
 *
 * The unsubscribe link must work from an email client with no session, so it
 * carries an HMAC of the user id signed with AUTH_SECRET — unguessable without
 * the secret, no extra token table, and it can't be replayed for another user.
 */

/** Signed token binding an unsubscribe link to one user. */
export function unsubscribeToken(userId: string, secret: string = env.AUTH_SECRET): string {
  return createHmac("sha256", secret).update(`unsubscribe:${userId}`).digest("hex").slice(0, 32);
}

/** Constant-time verification of an unsubscribe token. */
export function verifyUnsubscribeToken(
  userId: string,
  token: string,
  secret: string = env.AUTH_SECRET,
): boolean {
  const expected = unsubscribeToken(userId, secret);
  if (token.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}

/** One-click unsubscribe URL for email footers (and List-Unsubscribe headers). */
export function unsubscribeUrl(
  appUrl: string,
  userId: string,
  secret: string = env.AUTH_SECRET,
): string {
  const base = appUrl.replace(/\/$/, "");
  return `${base}/api/email/unsubscribe?u=${encodeURIComponent(userId)}&t=${unsubscribeToken(userId, secret)}`;
}

/** Standard email footer with the unsubscribe link. Pure. */
export function emailFooter(unsubUrl: string): string {
  return `— LaunchWake · you post it, we tell you where.\nManage emails in Settings, or unsubscribe with one click: ${unsubUrl}`;
}

/** Flip product-notification emails for a user (Settings toggle + unsubscribe). */
export async function setEmailNotifications(
  userId: string,
  enabled: boolean,
): Promise<boolean> {
  try {
    await db.user.update({
      where: { id: userId },
      data: { emailNotifications: enabled },
    });
    return true;
  } catch {
    // Unknown user (deleted account clicking an old link) — nothing to do.
    return false;
  }
}
