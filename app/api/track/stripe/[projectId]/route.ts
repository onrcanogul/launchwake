import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ingestRevenue } from "@/lib/attribution";
import { parseStripeRevenue, constructUserStripeEvent } from "@/lib/stripeRevenue";
import { withRetry, recordWebhookFailure } from "@/lib/webhookDelivery";

/**
 * Turnkey Stripe revenue webhook. The user points a Stripe webhook endpoint at
 * /api/track/stripe/{projectId} and pastes the endpoint's signing secret in
 * Settings. On a completed payment carrying metadata.lw_ref, we attribute the
 * revenue to the channel that drove it. Must read the RAW body for signature
 * verification.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await ctx.params;

  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { stripeWebhookSecret: true },
  });
  if (!project?.stripeWebhookSecret) {
    return NextResponse.json(
      { error: "Stripe revenue tracking isn't configured for this project." },
      { status: 404 },
    );
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const rawBody = await req.text();
  let event;
  try {
    event = constructUserStripeEvent(rawBody, signature, project.stripeWebhookSecret);
  } catch (err) {
    return NextResponse.json(
      { error: `Signature verification failed: ${(err as Error).message}` },
      { status: 400 },
    );
  }

  const revenue = parseStripeRevenue(event);
  if (!revenue) {
    // A valid event we simply don't attribute (no lw_ref, or not a payment).
    return NextResponse.json({ received: true, attributed: false });
  }

  // Ingest with a couple of quick retries for transient DB blips. If it still
  // throws, persist the failure for the founder to see and return 500 so Stripe
  // re-delivers with its own backoff — never silently drop attributed revenue.
  try {
    const ok = await withRetry(
      () =>
        ingestRevenue(revenue.ref, {
          amountCents: revenue.amountCents,
          currency: revenue.currency,
          recurring: revenue.recurring,
          meta: { via: "stripe", eventType: event.type },
        }),
      { attempts: 3 },
    );
    return NextResponse.json({ received: true, attributed: ok });
  } catch (err) {
    await recordWebhookFailure({
      source: "STRIPE_REVENUE",
      projectId,
      eventType: event.type,
      attempts: 3,
      error: (err as Error)?.message ?? String(err),
      // Stripe re-delivers failed (non-2xx) events itself; no cron re-drive.
      retryable: false,
    });
    return NextResponse.json(
      { error: "Failed to record revenue; will retry." },
      { status: 500 },
    );
  }
}
