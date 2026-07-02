import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { processIntentRadar } from "@/lib/jobs";

/**
 * Intent Radar cron. Schedule a runner to hit this a few times a day with the
 * CRON_SECRET. For each active query it sweeps HN + Reddit for people asking for
 * a tool like the founder's, ingests fresh matches (deduped), pre-drafts the top
 * ban-safe replies, and alerts the owner. Auth: "Authorization: Bearer
 * <CRON_SECRET>" or "?secret=<CRON_SECRET>".
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

  const summary = await processIntentRadar();
  return NextResponse.json({ ok: true, ...summary });
}

export const GET = handle;
export const POST = handle;
