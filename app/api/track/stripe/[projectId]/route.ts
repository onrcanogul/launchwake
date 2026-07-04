import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { constructUserStripeEvent } from "@/lib/stripeRevenue";
import { recordDelivery, processDelivery } from "@/lib/webhookDelivery";

/**
 * Turnkey Stripe revenue webhook. The user points a Stripe webhook endpoint at
 * /api/track/stripe/{projectId} and pastes the endpoint's signing secret in
 * Settings. On a completed payment carrying metadata.lw_ref, we attribute the
 * revenue to the channel that drove it. Must read the RAW body for signature
 * verification.
 *
 * Every verified event is persisted as a `WebhookDelivery` keyed by the Stripe
 * event id, so a re-delivery or a retry never double-counts revenue, and a
 * transient failure is retried by the retry-webhooks cron instead of vanishing.
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

  // Persist the verified event (idempotent on event.id), then attribute it.
  const { delivery } = await recordDelivery({
    source: "STRIPE",
    dedupeKey: event.id,
    projectId,
    eventType: event.type,
    payload: event,
    signature,
  });

  const outcome = await processDelivery(delivery);

  return NextResponse.json({
    received: true,
    attributed: outcome.attributed ?? false,
    status: outcome.status,
    deduped: outcome.deduped,
  });
}
