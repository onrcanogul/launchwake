import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { retryFailedDeliveries } from "@/lib/webhookDelivery";
import { runWebhookShipJob } from "@/lib/jobs";
import { captureError } from "@/lib/observability";

/**
 * Webhook retry cron. Driven by the external scheduler (GitHub Actions —
 * see .github/workflows/cron.yml) every 10 min with the CRON_SECRET; kept off
 * Vercel Cron since sub-daily schedules there need a paid plan. Reprocesses FAILED webhook
 * deliveries whose exponential backoff has elapsed (max 5 attempts), so a
 * transient ingestion failure never silently drops a Ship or a payment. For any
 * Ship a successful retry creates, it kicks off analysis. Never posts.
 * Auth: "Authorization: Bearer <CRON_SECRET>" or "?secret=<CRON_SECRET>".
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

  const summary = await retryFailedDeliveries();

  // Analyze + notify for ships resurrected by a successful retry — same
  // entitlement-aware job as the live webhook path. Best-effort, non-fatal.
  for (const shipId of summary.analyzedShipIds) {
    try {
      await runWebhookShipJob(shipId);
    } catch (err) {
      captureError(err, { at: "cron.retry-webhooks.analysis", shipId });
    }
  }

  return NextResponse.json({ ok: true, ...summary });
}

export const GET = handle;
export const POST = handle;
