import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { runWeeklyDigest } from "@/lib/digest";

/**
 * Weekly digest cron. Schedule a runner (Vercel Cron, GitHub Action, etc.) to
 * hit this every Monday morning with the CRON_SECRET. Emails each onboarded
 * account owner last week's numbers + what to do this week. Guarded so a double
 * fire within 6 days won't re-send. Auth: "Authorization: Bearer <CRON_SECRET>"
 * or "?secret=<CRON_SECRET>".
 */
async function handle(req: NextRequest) {
  if (env.CRON_SECRET) {
    const auth = req.headers.get("authorization");
    const bearer = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
    const secret = bearer ?? req.nextUrl.searchParams.get("secret");
    if (secret !== env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else if (env.NODE_ENV === "production") {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 401 });
  }

  const summary = await runWeeklyDigest();
  return NextResponse.json({ ok: true, ...summary });
}

export const GET = handle;
export const POST = handle;
