import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { runMonthlyReports } from "@/lib/monthlyReport";

/**
 * Monthly report cron. Schedule a runner (GitHub Action, etc.) to hit this on the
 * 1st of each month with the CRON_SECRET. Emails each opted-in project owner last
 * month's clicks/signups/revenue, one benchmark comparison, a suggested action,
 * and a copy-paste shareable line. Guarded per (project, month) so a double fire
 * won't re-send. Auth: "Authorization: Bearer <CRON_SECRET>" or "?secret=<CRON_SECRET>".
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

  const summary = await runMonthlyReports();
  return NextResponse.json({ ok: true, ...summary });
}

export const GET = handle;
export const POST = handle;
