import Stripe from "stripe";
import { db } from "./db";
import { env, requireEnv } from "./env";
import { ingestRevenue } from "./attribution";
import { captureError } from "./observability";
import type { Plan } from "@prisma/client";

/**
 * Billing + entitlements.
 *
 * Entitlements are DB-only (plan + counts) so they enforce in every environment,
 * even without Stripe. Checkout/portal/webhook require STRIPE_SECRET_KEY and
 * degrade gracefully when it's absent.
 *
 * Free: 1 project, 2 plans / month, solo. Pro: unlimited, solo. Team: unlimited,
 * seat-based (agencies & DevRel) — billed per seat.
 */

export const PRO_PRICE_CENTS = 2900;

// Team: simple per-seat model. 3-seat minimum → from $87/mo. Change these two
// constants to reprice; checkout, copy and ARPU all follow.
export const TEAM_PRICE_PER_SEAT_CENTS = 2900;
export const TEAM_MIN_SEATS = 3;
export const TEAM_MAX_SEATS = 50;

export const FREE_LIMITS = { projects: 1, plansPerMonth: 2 } as const;

// How many channels a Free plan can actually launch on (Launch Mode). The full
// ranked plan is always shown; acting on more than this is a Pro upgrade. Matches
// the public Launch Checker teaser so the free ceiling is consistent.
export const FREE_LAUNCH_CHANNELS = 3;

/** Max channels the plan can launch on; null = unlimited (paid). */
export function launchChannelLimit(plan: Plan | string): number | null {
  return isPaidPlan(plan) ? null : FREE_LAUNCH_CHANNELS;
}

/**
 * Paywall copy shown when a Free launch plan has more channels than the free
 * ceiling. Null when nothing is gated (paid, or at/under the limit).
 */
export function launchChannelPaywall(
  plan: Plan | string,
  totalChannels: number,
): string | null {
  const limit = launchChannelLimit(plan);
  if (limit === null || totalChannels <= limit) return null;
  const locked = totalChannels - limit;
  return `Your plan ranks all ${totalChannels} channels, but Free launches on ${limit}. Upgrade to Pro to launch on all ${totalChannels} — including the ${locked} locked below.`;
}

/**
 * Whether a recommendation is a locked launch channel — i.e. its rank sits past
 * the Free launch cap in a Launch-Mode project. Growth Mode (LAUNCHED) and paid
 * plans are never gated. Server-side guard so drafting a locked channel can't be
 * triggered by a crafted request (drafting is the Pro-gated action; attribution
 * is deliberately NOT gated — the human may post anywhere).
 */
export async function isLaunchChannelLocked(
  recommendationId: string,
  accountId: string,
): Promise<boolean> {
  const rec = await db.recommendation.findFirst({
    where: {
      id: recommendationId,
      plan: { ship: { project: { userId: accountId } } },
    },
    select: {
      rank: true,
      plan: {
        select: {
          ship: { select: { project: { select: { launchStage: true } } } },
        },
      },
    },
  });
  if (!rec) return false;
  if (rec.plan.ship.project.launchStage === "LAUNCHED") return false; // Growth Mode
  const account = await db.user.findUnique({
    where: { id: accountId },
    select: { plan: true },
  });
  const limit = launchChannelLimit(account?.plan ?? "FREE");
  return limit !== null && rec.rank >= limit;
}

// Intent Radar saved-query caps per plan. Free can't use it (upsell); Pro gets a
// handful; Team is unlimited (null). Not a simple paid→unlimited like projects.
export const INTENT_QUERY_LIMITS: Record<Plan, number | null> = {
  FREE: 0,
  PRO: 3,
  TEAM: null,
};

/** A paid plan (Pro or Team) — unlimited projects & plans. */
export function isPaidPlan(plan: Plan | string): boolean {
  return plan === "PRO" || plan === "TEAM";
}

/** Clamp a requested seat count to the allowed Team range. */
export function clampSeats(seats: number): number {
  if (!Number.isFinite(seats)) return TEAM_MIN_SEATS;
  return Math.min(TEAM_MAX_SEATS, Math.max(TEAM_MIN_SEATS, Math.round(seats)));
}

/** Monthly Team price for a seat count (in cents). */
export function teamPriceCents(seats: number): number {
  return clampSeats(seats) * TEAM_PRICE_PER_SEAT_CENTS;
}

export type EntitlementAction = "create_project" | "create_plan" | "create_intent_query";

export class EntitlementError extends Error {
  constructor(
    message: string,
    readonly action: EntitlementAction,
  ) {
    super(message);
    this.name = "EntitlementError";
  }
}

function monthStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export type PlanUsage = {
  plan: Plan;
  seats: number;
  projectCount: number;
  projectLimit: number | null; // null = unlimited
  plansThisMonth: number;
  planLimit: number | null;
  intentQueryCount: number;
  intentQueryLimit: number | null; // null = unlimited
};

export async function getPlanUsage(userId: string): Promise<PlanUsage> {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { plan: true, seats: true },
  });

  const [projectCount, plansThisMonth, intentQueryCount] = await Promise.all([
    db.project.count({ where: { userId } }),
    db.distributionPlan.count({
      where: {
        createdAt: { gte: monthStart() },
        ship: { project: { userId } },
      },
    }),
    db.intentQuery.count({ where: { project: { userId } } }),
  ]);

  const paid = isPaidPlan(user.plan);
  return {
    plan: user.plan,
    seats: user.seats,
    projectCount,
    projectLimit: paid ? null : FREE_LIMITS.projects,
    plansThisMonth,
    planLimit: paid ? null : FREE_LIMITS.plansPerMonth,
    intentQueryCount,
    intentQueryLimit: INTENT_QUERY_LIMITS[user.plan],
  };
}

/**
 * Pure limit check: returns an error message if `action` would exceed the plan
 * limits reflected in `usage`, else null. (null limit = unlimited = allowed.)
 */
export function entitlementViolation(
  usage: PlanUsage,
  action: EntitlementAction,
): string | null {
  if (action === "create_project") {
    if (usage.projectLimit !== null && usage.projectCount >= usage.projectLimit) {
      return `The Free plan includes ${usage.projectLimit} project. Upgrade to Pro to add more.`;
    }
  }
  if (action === "create_plan") {
    if (usage.planLimit !== null && usage.plansThisMonth >= usage.planLimit) {
      return `You've used ${usage.plansThisMonth}/${usage.planLimit} distribution plans on the Free plan this month. Upgrade to Pro for unlimited plans.`;
    }
  }
  if (action === "create_intent_query") {
    if (usage.intentQueryLimit !== null && usage.intentQueryCount >= usage.intentQueryLimit) {
      return usage.intentQueryLimit === 0
        ? "Intent Radar is a Pro feature — watch HN & Reddit for people asking for your product. Upgrade to Pro to turn it on."
        : `Pro includes ${usage.intentQueryLimit} Intent Radar queries. Upgrade to Team for unlimited.`;
    }
  }
  return null;
}

/** Throw EntitlementError if the action would exceed the user's plan limits. */
export async function assertEntitlement(
  userId: string,
  action: EntitlementAction,
): Promise<void> {
  const usage = await getPlanUsage(userId);
  const violation = entitlementViolation(usage, action);
  if (violation) throw new EntitlementError(violation, action);
}

// ── Stripe ─────────────────────────────────────────────────

let stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!stripe) {
    stripe = new Stripe(requireEnv("STRIPE_SECRET_KEY", "Billing"));
  }
  return stripe;
}

export function billingConfigured(): boolean {
  return Boolean(env.STRIPE_SECRET_KEY);
}

async function ensureCustomer(userId: string): Promise<string> {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.stripeCustomerId) return user.stripeCustomerId;

  const customer = await getStripe().customers.create({
    email: user.email,
    name: user.name ?? undefined,
    metadata: { userId },
  });
  await db.user.update({
    where: { id: userId },
    data: { stripeCustomerId: customer.id },
  });
  return customer.id;
}

export type CheckoutOptions = { plan?: "PRO" | "TEAM"; seats?: number };

/** Create a Checkout session for Pro or Team; returns the redirect URL. */
export async function createCheckoutUrl(
  userId: string,
  opts: CheckoutOptions = {},
): Promise<string> {
  const customerId = await ensureCustomer(userId);
  const appUrl = env.APP_URL.replace(/\/$/, "");
  const plan = opts.plan ?? "PRO";
  const seats = plan === "TEAM" ? clampSeats(opts.seats ?? TEAM_MIN_SEATS) : 1;

  const lineItem =
    plan === "TEAM"
      ? {
          quantity: seats,
          price_data: {
            currency: "usd",
            unit_amount: TEAM_PRICE_PER_SEAT_CENTS,
            recurring: { interval: "month" as const },
            product_data: { name: "LaunchWake Team (per seat)" },
          },
        }
      : {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: PRO_PRICE_CENTS,
            recurring: { interval: "month" as const },
            product_data: { name: "LaunchWake Pro" },
          },
        };

  const meta: Record<string, string> = { userId, plan, seats: String(seats) };
  // Stamp the channel ref captured at signup onto the subscription. Attribution
  // itself runs in-process on invoice.paid (see attributeInvoiceRevenue), which
  // resolves the ref from User.lwRef — so this metadata records nothing on its
  // own. It's a provider-native breadcrumb (visible in the Stripe dashboard, and
  // what a turnkey /api/track/stripe webhook would read if one were ever wired
  // for another account). Do NOT point such a webhook at THIS account's events,
  // or the same payment would be counted twice.
  const { lwRef } = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { lwRef: true },
  });
  if (lwRef) meta.lw_ref = lwRef;

  const session = await getStripe().checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [lineItem],
    success_url: `${appUrl}/app/settings?upgraded=1`,
    cancel_url: `${appUrl}/app/settings`,
    metadata: meta,
    subscription_data: { metadata: meta },
  });

  if (!session.url) throw new Error("Stripe did not return a checkout URL.");
  return session.url;
}

/** Create a Billing Portal session for managing the subscription. */
export async function createPortalUrl(userId: string): Promise<string> {
  const customerId = await ensureCustomer(userId);
  const appUrl = env.APP_URL.replace(/\/$/, "");
  const session = await getStripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: `${appUrl}/app/settings`,
  });
  return session.url;
}

/** Verify + parse a webhook payload. */
export function constructWebhookEvent(
  rawBody: string,
  signature: string,
): Stripe.Event {
  return getStripe().webhooks.constructEvent(
    rawBody,
    signature,
    requireEnv("STRIPE_WEBHOOK_SECRET", "Billing webhook"),
  );
}

/** Apply a Stripe event to our user's plan. */
export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      const customerId =
        typeof session.customer === "string" ? session.customer : undefined;
      const plan: Plan = session.metadata?.plan === "TEAM" ? "TEAM" : "PRO";
      const seats = plan === "TEAM" ? clampSeats(Number(session.metadata?.seats)) : 1;
      if (userId) {
        await db.user.update({
          where: { id: userId },
          data: { plan, seats, stripeCustomerId: customerId },
        });
      }
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId =
        typeof sub.customer === "string" ? sub.customer : sub.customer.id;
      const active = sub.status === "active" || sub.status === "trialing";
      const plan: Plan = sub.metadata?.plan === "TEAM" ? "TEAM" : "PRO";
      // Seat count follows the subscription item quantity (per-seat Team plan).
      const qty = sub.items?.data?.[0]?.quantity ?? 1;
      const seats = active && plan === "TEAM" ? clampSeats(qty) : 1;
      const user = await db.user.findFirst({
        where: { stripeCustomerId: customerId },
      });
      if (user) {
        await db.user.update({
          where: { id: user.id },
          data: { plan: active ? plan : "FREE", seats },
        });
      }
      break;
    }
    // Dogfood revenue attribution. We attribute on `invoice.paid` only — it fires
    // for the first subscription invoice AND every renewal, so each paid invoice
    // is credited exactly once (not double-counted against
    // checkout.session.completed or invoice.payment_succeeded, which cover the
    // same money). Idempotency across Stripe retries is guaranteed by
    // processStripeEvent's per-event-id claim.
    case "invoice.paid": {
      await attributeInvoiceRevenue(event.data.object as StripeInvoiceish);
      break;
    }
    default:
      break;
  }
}

// Minimal, version-agnostic view of a Stripe invoice — we only read the fields
// we attribute on, so we don't couple to Stripe's shifting Invoice type across
// API versions (`subscription` in particular has moved around).
type SubRef = string | { id?: string } | null | undefined;
type StripeInvoiceish = {
  id?: string;
  customer?: string | { id?: string } | null;
  amount_paid?: number | null;
  amount_due?: number | null;
  currency?: string | null;
  // How we tell a subscription invoice (→ MRR) from a one-off charge. Stripe
  // moved this around: older API versions expose a top-level `subscription`;
  // 2025+/2026-02-25.clover dropped it in favour of `parent.subscription_details`
  // and per-line `subscription`. `billing_reason` (subscription_create/_cycle/…)
  // is stable across all of them, so we check every signal.
  subscription?: SubRef;
  billing_reason?: string | null;
  parent?: { subscription_details?: { subscription?: SubRef } | null } | null;
  lines?: { data?: Array<{ subscription?: SubRef } | null> } | null;
};

/** Version-robust "is this a subscription invoice?" — see StripeInvoiceish. */
function isRecurringInvoice(invoice: StripeInvoiceish): boolean {
  if (invoice.subscription) return true;
  if (invoice.parent?.subscription_details?.subscription) return true;
  if (invoice.lines?.data?.some((l) => l?.subscription)) return true;
  return (
    typeof invoice.billing_reason === "string" &&
    invoice.billing_reason.startsWith("subscription")
  );
}

/**
 * Dogfood: attribute LaunchWake's OWN subscription revenue back to the channel
 * that drove the signup. The paying user's `lw_ref` (a tracked-link short code)
 * is stored on their User row at signup, so we resolve it from the invoice's
 * Stripe customer id — no `lw_ref` in Stripe metadata required. Records the
 * revenue in-process via `ingestRevenue` (the same path /api/track/revenue uses).
 *
 * Best-effort: any failure is logged and swallowed so it never bubbles up to
 * fail the webhook or the plan change (which would trigger a full Stripe retry
 * and risk re-attributing). Returns whether the payment was attributed.
 */
export async function attributeInvoiceRevenue(
  invoice: StripeInvoiceish,
  client: Pick<typeof db, "user" | "trackedLink" | "event"> = db,
): Promise<boolean> {
  try {
    const customerId =
      typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
    if (!customerId) return false;

    const amountCents = Number(invoice.amount_paid ?? invoice.amount_due);
    if (!Number.isFinite(amountCents) || amountCents <= 0) return false;

    const user = await client.user.findFirst({
      where: { stripeCustomerId: customerId },
      select: { lwRef: true },
    });
    const ref = user?.lwRef;
    if (!ref) return false; // unknown customer or signup carried no channel ref

    return await ingestRevenue(
      ref,
      {
        amountCents,
        currency: invoice.currency ?? "usd",
        recurring: isRecurringInvoice(invoice),
        meta: { via: "stripe-self", invoiceId: invoice.id },
      },
      client,
    );
  } catch (err) {
    captureError(err, { at: "billing.attributeInvoiceRevenue", invoiceId: invoice.id });
    return false;
  }
}

/**
 * Idempotent entry point for the webhook route. Stripe retries redeliver the
 * same `event.id`; we claim it once (unique insert) before applying, so a
 * duplicate delivery is a no-op instead of double-applying a plan change. If the
 * handler throws we release the claim so Stripe's retry can reprocess it.
 * Returns false when the event was already processed (a duplicate).
 */
export async function processStripeEvent(event: Stripe.Event): Promise<boolean> {
  try {
    await db.processedStripeEvent.create({
      data: { eventId: event.id, type: event.type },
    });
  } catch (err) {
    // P2002 = unique violation → already claimed/processed → skip.
    if ((err as { code?: string }).code === "P2002") return false;
    throw err;
  }

  try {
    await handleStripeEvent(event);
  } catch (err) {
    // Release the claim so a retry isn't permanently swallowed.
    await db.processedStripeEvent.delete({ where: { eventId: event.id } }).catch(() => {});
    throw err;
  }
  return true;
}
