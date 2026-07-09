import { Polar } from "@polar-sh/sdk";
import { validateEvent, WebhookVerificationError } from "@polar-sh/sdk/webhooks";
import { db } from "./db";
import { env, requireEnv } from "./env";
import { ingestRevenue } from "./attribution";
import { captureError } from "./observability";
import { clampSeats, TEAM_MIN_SEATS, TEAM_PRICE_PER_SEAT_CENTS } from "./billing";
import type { Plan } from "@prisma/client";

/**
 * Polar billing — LaunchWake's OWN subscription billing via Polar (polar.sh),
 * running in parallel with the Stripe path in lib/billing.ts. Entitlements stay
 * in the DB (User.plan + counts, enforced everywhere via lib/billing); this
 * module only handles Polar checkout + webhook → flipping User.plan/seats, plus
 * dogfood revenue attribution (mirrors attributeInvoiceRevenue).
 *
 * Everything is optional-to-boot: absent POLAR_* env → polarConfigured() is
 * false and the app falls back to Stripe. When configured, checkout prefers Polar.
 *
 * Product → plan: Pro (monthly) and Pro Annual both grant PRO; Team grants
 * seat-based TEAM (seats derived from the subscription amount); Launch Pass is a
 * one-off (revenue only, no plan tier).
 */

export { WebhookVerificationError };

// ── Config ─────────────────────────────────────────────────

/** True when Polar checkout can run (token + at least the Pro product). */
export function polarConfigured(): boolean {
  return Boolean(env.POLAR_ACCESS_TOKEN && env.POLAR_PRODUCT_PRO);
}

let polarClient: Polar | null = null;
function getPolar(): Polar {
  if (!polarClient) {
    polarClient = new Polar({
      accessToken: requireEnv("POLAR_ACCESS_TOKEN", "Polar"),
      server: env.POLAR_ENV,
    });
  }
  return polarClient;
}

// ── Product ↔ plan mapping (pure) ──────────────────────────

export type PolarProductIds = { pro?: string; proAnnual?: string; team?: string };

function envProductIds(): PolarProductIds {
  return {
    pro: env.POLAR_PRODUCT_PRO,
    proAnnual: env.POLAR_PRODUCT_PRO_ANNUAL,
    team: env.POLAR_PRODUCT_TEAM,
  };
}

/** Map a Polar product id to the plan it grants; null = not a plan tier. */
export function planForProductId(
  productId: string | null | undefined,
  ids: PolarProductIds,
): Plan | null {
  if (!productId) return null;
  if (productId === ids.pro || productId === ids.proAnnual) return "PRO";
  if (productId === ids.team) return "TEAM";
  return null;
}

/** Env-bound convenience wrapper around planForProductId. */
export function polarPlanForProduct(productId: string | null | undefined): Plan | null {
  return planForProductId(productId, envProductIds());
}

/**
 * Derive the Team seat count from a subscription's total amount (in cents). The
 * per-seat Team plan bills seats × TEAM_PRICE_PER_SEAT_CENTS, so seats is the
 * amount divided by the per-seat price, clamped to the allowed range.
 */
export function seatsFromAmount(amountCents: number): number {
  if (!Number.isFinite(amountCents) || amountCents <= 0) return TEAM_MIN_SEATS;
  return clampSeats(Math.round(amountCents / TEAM_PRICE_PER_SEAT_CENTS));
}

/**
 * Pure plan/seat resolution for a subscription snapshot. Active/trialing on a
 * mapped product → that plan; anything else (canceled, past_due, unmapped) →
 * FREE. Seats only apply to TEAM. Status-driven so a "cancel at period end"
 * (still active) keeps access until Polar reports a non-active status.
 */
export function subscriptionPlanUpdate(
  sub: { productId?: string | null; status: string; amount?: number | null },
  ids: PolarProductIds,
): { plan: Plan; seats: number } {
  const mapped = planForProductId(sub.productId, ids);
  const active = sub.status === "active" || sub.status === "trialing";
  const plan: Plan = active && mapped ? mapped : "FREE";
  const seats = plan === "TEAM" ? seatsFromAmount(Number(sub.amount)) : 1;
  return { plan, seats };
}

// ── Checkout ───────────────────────────────────────────────

export type PolarCheckoutOptions = {
  plan?: "PRO" | "TEAM";
  seats?: number;
  /** Bill Pro annually (uses the Pro Annual product). Ignored for Team. */
  annual?: boolean;
};

/** Create a Polar Checkout for Pro or Team; returns the hosted checkout URL. */
export async function createPolarCheckoutUrl(
  userId: string,
  opts: PolarCheckoutOptions = {},
): Promise<string> {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { email: true, lwRef: true },
  });
  const plan = opts.plan ?? "PRO";
  const productId =
    plan === "TEAM"
      ? requireEnv("POLAR_PRODUCT_TEAM", "Polar Team checkout")
      : opts.annual
        ? requireEnv("POLAR_PRODUCT_PRO_ANNUAL", "Polar Pro annual checkout")
        : requireEnv("POLAR_PRODUCT_PRO", "Polar Pro checkout");

  const appUrl = env.APP_URL.replace(/\/$/, "");
  // metadata rides along to the subscription/order webhooks so we can resolve the
  // paying user by id (email is the fallback). lw_ref is a dogfood breadcrumb.
  const metadata: Record<string, string> = { userId, plan };
  if (plan === "TEAM") metadata.seats = String(clampSeats(opts.seats ?? TEAM_MIN_SEATS));
  if (user.lwRef) metadata.lw_ref = user.lwRef;

  const checkout = await getPolar().checkouts.create({
    products: [productId],
    customerEmail: user.email,
    successUrl: `${appUrl}/app/settings?upgraded=1`,
    metadata,
  });
  if (!checkout.url) throw new Error("Polar did not return a checkout URL.");
  return checkout.url;
}

// ── Webhook ────────────────────────────────────────────────

export type PolarEvent = ReturnType<typeof validateEvent>;

/**
 * Verify a Polar webhook (Standard Webhooks signature) and return the typed,
 * parsed event. Throws WebhookVerificationError on a bad/missing signature.
 * Pass the raw request body and the webhook-id/timestamp/signature headers.
 */
export function validatePolarEvent(
  rawBody: string,
  headers: Record<string, string>,
): PolarEvent {
  return validateEvent(rawBody, headers, requireEnv("POLAR_WEBHOOK_SECRET", "Polar webhook"));
}

type PolarDbClient = Pick<
  typeof db,
  "user" | "processedStripeEvent" | "trackedLink" | "event"
>;

function metaString(
  metadata: Record<string, unknown> | null | undefined,
  key: string,
): string | undefined {
  const v = metadata?.[key];
  return typeof v === "string" ? v : undefined;
}

/** Resolve our User id from webhook metadata (userId) then customer email. */
async function resolveUserId(
  client: Pick<typeof db, "user">,
  metadata: Record<string, unknown> | null | undefined,
  email: string | null | undefined,
): Promise<string | null> {
  const metaUserId = metaString(metadata, "userId");
  if (metaUserId) {
    const u = await client.user.findUnique({ where: { id: metaUserId }, select: { id: true } });
    if (u) return u.id;
  }
  if (email) {
    const u = await client.user.findUnique({ where: { email }, select: { id: true } });
    if (u) return u.id;
  }
  return null;
}

type PolarOrderish = {
  id?: string;
  netAmount?: number | null;
  totalAmount?: number | null;
  currency?: string | null;
  billingReason?: string | null;
  metadata?: Record<string, unknown> | null;
  customer?: { email?: string | null } | null;
};

/**
 * Dogfood: attribute LaunchWake's OWN Polar revenue back to the channel that
 * drove the paying user's signup (their lwRef). Fires on order.paid, which
 * covers first payment, renewals (billing_reason subscription_cycle) and one-off
 * purchases — so each paid order is credited once. Best-effort: any failure is
 * logged and swallowed so it never fails the webhook. Mirrors
 * attributeInvoiceRevenue in lib/billing.
 */
export async function attributePolarOrder(
  order: PolarOrderish,
  client: Pick<typeof db, "user" | "trackedLink" | "event"> = db,
): Promise<boolean> {
  try {
    const amountCents = Number(order.netAmount ?? order.totalAmount);
    if (!Number.isFinite(amountCents) || amountCents <= 0) return false;

    let lwRef: string | null = metaString(order.metadata, "lw_ref") ?? null;
    if (!lwRef) {
      const metaUserId = metaString(order.metadata, "userId");
      if (metaUserId) {
        const u = await client.user.findUnique({
          where: { id: metaUserId },
          select: { lwRef: true },
        });
        lwRef = u?.lwRef ?? null;
      }
    }
    if (!lwRef && order.customer?.email) {
      const u = await client.user.findUnique({
        where: { email: order.customer.email },
        select: { lwRef: true },
      });
      lwRef = u?.lwRef ?? null;
    }
    if (!lwRef) return false; // unknown customer or signup carried no channel ref

    // Anything other than a one-off "purchase" is subscription revenue (→ MRR).
    const recurring =
      typeof order.billingReason === "string" && order.billingReason !== "purchase";

    return await ingestRevenue(
      lwRef,
      {
        amountCents,
        currency: order.currency ?? "usd",
        recurring,
        meta: { via: "polar-self", orderId: order.id },
      },
      client,
    );
  } catch (err) {
    captureError(err, { at: "polar.attributePolarOrder", orderId: order?.id });
    return false;
  }
}

/** Apply a verified Polar event to our user's plan + attribute revenue. */
export async function handlePolarEvent(
  event: PolarEvent,
  client: PolarDbClient = db,
): Promise<void> {
  switch (event.type) {
    // Subscription lifecycle → status-driven plan/seat resolution.
    case "subscription.active":
    case "subscription.updated":
    case "subscription.canceled": {
      const sub = event.data;
      const userId = await resolveUserId(client, sub.metadata, sub.customer.email);
      if (!userId) break;
      const { plan, seats } = subscriptionPlanUpdate(
        { productId: sub.productId, status: String(sub.status), amount: sub.amount },
        envProductIds(),
      );
      await client.user.update({ where: { id: userId }, data: { plan, seats } });
      break;
    }
    // Access removed (final downgrade).
    case "subscription.revoked": {
      const sub = event.data;
      const userId = await resolveUserId(client, sub.metadata, sub.customer.email);
      if (userId) {
        await client.user.update({
          where: { id: userId },
          data: { plan: "FREE", seats: 1 },
        });
      }
      break;
    }
    // Money moved → dogfood attribution (plan changes ride the subscription events).
    case "order.paid": {
      await attributePolarOrder(event.data, client);
      break;
    }
    default:
      break;
  }
}

/**
 * Idempotent entry point for the webhook route. Standard Webhooks redeliver with
 * the same `webhook-id`; we claim it once before applying so a retry is a no-op
 * instead of double-flipping a plan. If the handler throws we release the claim
 * so the retry can reprocess. Returns false when already processed.
 *
 * Reuses the ProcessedStripeEvent ledger (a generic "processed webhook events"
 * table: eventId unique, type, processedAt) with a `polar:` id prefix — Polar
 * webhook-ids are UUIDs, Stripe ids are `evt_…`, so they never collide. This
 * avoids a schema migration for a second provider.
 */
export async function processPolarEvent(
  idempotencyKey: string,
  event: PolarEvent,
  client: PolarDbClient = db,
): Promise<boolean> {
  const eventId = `polar:${idempotencyKey}`;
  try {
    await client.processedStripeEvent.create({ data: { eventId, type: event.type } });
  } catch (err) {
    // P2002 = unique violation → already claimed/processed → skip.
    if ((err as { code?: string }).code === "P2002") return false;
    throw err;
  }

  try {
    await handlePolarEvent(event, client);
  } catch (err) {
    await client.processedStripeEvent
      .delete({ where: { eventId } })
      .catch(() => {});
    throw err;
  }
  return true;
}
