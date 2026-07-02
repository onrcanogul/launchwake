import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ingestRevenue } from "@/lib/attribution";
import { parseStripeRevenue, constructUserStripeEvent } from "@/lib/stripeRevenue";

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

  const ok = await ingestRevenue(revenue.ref, {
    amountCents: revenue.amountCents,
    currency: revenue.currency,
    recurring: revenue.recurring,
    meta: { via: "stripe", eventType: event.type },
  });

  return NextResponse.json({ received: true, attributed: ok });
}
