import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { processDueReminders } from "@/lib/jobs";
import { processMilestones } from "@/lib/milestones";
import { processActivationDrip } from "@/lib/drip";

/**
 * Reminder delivery cron. Wire a scheduler (Vercel Cron, GitHub Action, etc.) to
 * hit this every ~5 minutes with the CRON_SECRET. Delivers every due reminder as
 * an email/Slack ping (never posts), and — piggybacked here — the batched
 * milestone notifications and the activation-drip emails (both idempotent and
 * self-throttled). Auth: "Authorization: Bearer <CRON_SECRET>" or
 * "?secret=<CRON_SECRET>".
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

  // Reminders are the primary job; the lifecycle passes are best-effort ridealongs
  // (each never throws) so a hiccup in one can't drop a due reminder.
  const summary = await processDueReminders();
  const milestones = await processMilestones();
  const drip = await processActivationDrip();
  return NextResponse.json({ ok: true, ...summary, milestones, drip });
}

export const GET = handle;
export const POST = handle;
