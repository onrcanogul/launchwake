import { NextRequest, NextResponse } from "next/server";
import {
  validatePolarEvent,
  processPolarEvent,
  WebhookVerificationError,
} from "@/lib/polar";
import { captureError } from "@/lib/observability";

/**
 * Polar webhook. Verifies the Standard Webhooks signature, then flips the user's
 * plan on subscription lifecycle events and attributes order revenue. Must read
 * the RAW body for signature verification, and uses the `webhook-id` header as
 * the idempotency key (Standard Webhooks retries reuse it).
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const headers = {
    "webhook-id": req.headers.get("webhook-id") ?? "",
    "webhook-timestamp": req.headers.get("webhook-timestamp") ?? "",
    "webhook-signature": req.headers.get("webhook-signature") ?? "",
  };

  let event;
  try {
    event = validatePolarEvent(rawBody, headers);
  } catch (err) {
    if (err instanceof WebhookVerificationError) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
    }
    return NextResponse.json(
      { error: `Webhook error: ${(err as Error).message}` },
      { status: 400 },
    );
  }

  try {
    const applied = await processPolarEvent(headers["webhook-id"], event);
    return NextResponse.json({ received: true, applied });
  } catch (err) {
    captureError(err, { at: "polar.webhook", type: event.type });
    return NextResponse.json(
      { error: `Handler error: ${(err as Error).message}` },
      { status: 500 },
    );
  }
}
