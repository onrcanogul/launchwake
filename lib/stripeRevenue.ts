import Stripe from "stripe";

/**
 * Turnkey Stripe revenue attribution. The user adds ONE webhook endpoint to
 * their Stripe dashboard pointing at /api/track/stripe/{projectId} and, when
 * creating a Checkout Session (or Customer/Subscription), sets metadata.lw_ref
 * to the value they captured from the tracked-link click. We verify the
 * signature with their endpoint secret and attribute the payment to the channel.
 *
 * `parseStripeRevenue` is pure → unit-testable without a live Stripe.
 */

export type ParsedRevenue = {
  ref: string;
  amountCents: number;
  currency: string;
  recurring: boolean;
};

type WithMeta = { metadata?: Record<string, string> | null } | null | undefined;

function metaRef(...objs: WithMeta[]): string | null {
  for (const o of objs) {
    const r = o?.metadata?.lw_ref;
    if (typeof r === "string" && r.length > 0) return r;
  }
  return null;
}

/**
 * Extract an attributable payment from a Stripe event, or null if this event
 * isn't a completed payment / carries no lw_ref. Handles one-time checkouts and
 * subscription invoices (recurring → counts toward MRR).
 */
export function parseStripeRevenue(event: {
  type: string;
  data: { object: unknown };
}): ParsedRevenue | null {
  const obj = event?.data?.object as Record<string, unknown> | undefined;
  if (!obj) return null;

  if (event.type === "checkout.session.completed") {
    const ref = metaRef(obj as WithMeta);
    const amountCents = Number(obj.amount_total);
    if (!ref || !Number.isFinite(amountCents) || amountCents <= 0) return null;
    return {
      ref,
      amountCents,
      currency: String(obj.currency ?? "usd"),
      recurring: obj.mode === "subscription",
    };
  }

  if (event.type === "invoice.paid" || event.type === "invoice.payment_succeeded") {
    const lines = obj.lines as { data?: WithMeta[] } | undefined;
    const ref = metaRef(
      obj as WithMeta,
      obj.subscription_details as WithMeta,
      lines?.data?.[0],
    );
    const amountCents = Number(obj.amount_paid ?? obj.amount_due);
    if (!ref || !Number.isFinite(amountCents) || amountCents <= 0) return null;
    return {
      ref,
      amountCents,
      currency: String(obj.currency ?? "usd"),
      recurring: Boolean(obj.subscription),
    };
  }

  return null;
}

// Signature verification only needs the endpoint secret + payload; the API key
// is never used to call Stripe, so a placeholder is fine for a verify-only client.
let verifier: Stripe | null = null;
function getVerifier(): Stripe {
  if (!verifier) verifier = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_verify_only");
  return verifier;
}

/** Verify a user's Stripe webhook against their endpoint signing secret. */
export function constructUserStripeEvent(
  rawBody: string,
  signature: string,
  endpointSecret: string,
): Stripe.Event {
  return getVerifier().webhooks.constructEvent(rawBody, signature, endpointSecret);
}
