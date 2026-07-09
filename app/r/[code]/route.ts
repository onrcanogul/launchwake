import { NextRequest, NextResponse } from "next/server";
import { ingestClick, clickDedupeKey, emailHash } from "@/lib/attribution";
import { rateLimitDurable, clientIp } from "@/lib/ratelimit";
import { isLikelyBot, botSignalsFromHeaders } from "@/lib/botDetection";
import { env } from "@/lib/env";

/**
 * Tracked-link redirect. Logs a CLICK, drops a first-party lw_ref cookie (90d, in
 * case the product is same-site), and 302s to the product URL with ?lw_ref
 * appended. The redirect always works; over the per-IP limit, for a bot/prefetch,
 * we skip the CLICK write so a script/crawler can't inflate click counts.
 * Recording is a single-query idempotent upsert (dedupe key), so the redirect's
 * latency profile is unchanged. Destination is validated http(s) upstream.
 *
 * Optional cross-device recovery: a personalized link (e.g. a per-recipient
 * newsletter) may pass `?eh=<sha256 hex>` (preferred, PII-safe) or `?email=<raw>`;
 * we store the emailHash on the CLICK so a later ref-less signup with the same
 * email can be recovered to this channel. Absent by default.
 */

// Generous: a real human clicks a link a handful of times, not 60×/min.
const LIMIT = 60;
const WINDOW_MS = 60 * 1000;
// Match the pixel's localStorage carrier: keep the ref alive for 90 days.
const COOKIE_MAX_AGE = 60 * 60 * 24 * 90;

/** Resolve an optional emailHash from a pre-hashed `eh` (preferred) or raw `email`. */
function clickEmailHash(req: NextRequest): string | null {
  const eh = req.nextUrl.searchParams.get("eh");
  if (eh && /^[0-9a-fA-F]{64}$/.test(eh)) return eh.toLowerCase();
  const email = req.nextUrl.searchParams.get("email");
  return email ? emailHash(email) : null;
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ code: string }> },
) {
  const { code } = await ctx.params;
  const ip = clientIp(req.headers);
  const rl = await rateLimitDurable(`click:${ip}`, LIMIT, WINDOW_MS);
  // Crawlers, link-preview unfurlers, and browser prefetch get redirected but not
  // counted — a speculative load is not a human deciding to click.
  const bot = isLikelyBot(botSignalsFromHeaders(req.headers));
  const record = rl.ok && !bot;
  const dedupeKey = record
    ? clickDedupeKey({ ip, userAgent: req.headers.get("user-agent") ?? "", shortCode: code })
    : null;
  const dest = await ingestClick(code, {
    record,
    dedupeKey,
    emailHash: record ? clickEmailHash(req) : null,
  });

  if (!dest) {
    return NextResponse.redirect(new URL("/", env.APP_URL));
  }

  const res = NextResponse.redirect(dest);
  res.cookies.set("lw_ref", code, {
    maxAge: COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
  });
  return res;
}
