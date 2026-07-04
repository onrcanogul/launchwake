import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { retryDueWebhookDeliveries } from "@/lib/jobs";

/**
 * Webhook retry cron. Wire a scheduler (Vercel Cron, GitHub Action, …) to hit
 * this every ~10 minutes with the CRON_SECRET. Re-drives GitHub auto-detect
 * analyses that failed after their in-request retries, backing off per attempt
 * and dead-lettering after the cap. Auth: "Authorization: Bearer <CRON_SECRET>"
 * or "?secret=<CRON_SECRET>". Never posts anything.
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
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 401 },
    );
  }

  const summary = await retryDueWebhookDeliveries();
  return NextResponse.json({ ok: true, ...summary });
}

export const GET = handle;
export const POST = handle;
