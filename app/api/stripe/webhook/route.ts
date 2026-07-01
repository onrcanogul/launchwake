import { NextRequest, NextResponse } from "next/server";
import { constructWebhookEvent, handleStripeEvent } from "@/lib/billing";

/**
 * Stripe webhook. Verifies the signature, then flips the user's plan on
 * subscription lifecycle events. Must read the RAW body for signature checks.
 */
export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const rawBody = await req.text();
  let event;
  try {
    event = constructWebhookEvent(rawBody, signature);
  } catch (err) {
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${(err as Error).message}` },
      { status: 400 },
    );
  }

  try {
    await handleStripeEvent(event);
  } catch (err) {
    return NextResponse.json(
      { error: `Handler error: ${(err as Error).message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ received: true });
}
