import { NextRequest, NextResponse } from "next/server";
import { ingestClick } from "@/lib/attribution";
import { rateLimitDurable, clientIp } from "@/lib/ratelimit";
import { env } from "@/lib/env";

/**
 * Tracked-link redirect. Logs a CLICK, drops a first-party lw_ref cookie (in case
 * the product is same-site), and 302s to the product URL with ?lw_ref appended.
 * The redirect always works; over the per-IP limit we skip the CLICK write so a
 * script can't inflate click counts. Destination is validated http(s) upstream.
 */

// Generous: a real human clicks a link a handful of times, not 60×/min.
const LIMIT = 60;
const WINDOW_MS = 60 * 1000;

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ code: string }> },
) {
  const { code } = await ctx.params;
  const rl = await rateLimitDurable(`click:${clientIp(req.headers)}`, LIMIT, WINDOW_MS);
  const dest = await ingestClick(code, { record: rl.ok });

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
