import { NextRequest, NextResponse } from "next/server";
import { ingestClick, clickDedupeKey } from "@/lib/attribution";
import { rateLimitDurable, clientIp } from "@/lib/ratelimit";
import { isLikelyBot, botSignalsFromHeaders } from "@/lib/botDetection";
import { env } from "@/lib/env";

/**
 * Tracked-link redirect. Logs a CLICK, drops a first-party lw_ref cookie (in case
 * the product is same-site), and 302s to the product URL with ?lw_ref appended.
 * The redirect always works; over the per-IP limit, for a bot/prefetch, we skip
 * the CLICK write so a script/crawler can't inflate click counts. Recording is a
 * single-query idempotent upsert (dedupe key), so the redirect's latency profile
 * is unchanged. Destination is validated http(s) upstream.
 */

// Generous: a real human clicks a link a handful of times, not 60×/min.
const LIMIT = 60;
const WINDOW_MS = 60 * 1000;

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
  const dest = await ingestClick(code, { record, dedupeKey });

  if (!dest) {
    return NextResponse.redirect(new URL("/", env.APP_URL));
  }

  const res = NextResponse.redirect(dest);
  res.cookies.set("lw_ref", code, {
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
    sameSite: "lax",
  });
  return res;
}
