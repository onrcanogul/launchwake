import Stripe from "stripe";
import { db } from "./db";
import { env, requireEnv } from "./env";
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

export type EntitlementAction = "create_project" | "create_plan";

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
};

export async function getPlanUsage(userId: string): Promise<PlanUsage> {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { plan: true, seats: true },
  });

  const [projectCount, plansThisMonth] = await Promise.all([
    db.project.count({ where: { userId } }),
    db.distributionPlan.count({
      where: {
        createdAt: { gte: monthStart() },
        ship: { project: { userId } },
      },
    }),
  ]);

  const paid = isPaidPlan(user.plan);
  return {
    plan: user.plan,
    seats: user.seats,
    projectCount,
    projectLimit: paid ? null : FREE_LIMITS.projects,
    plansThisMonth,
    planLimit: paid ? null : FREE_LIMITS.plansPerMonth,
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

  const meta = { userId, plan, seats: String(seats) };
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
    default:
      break;
  }
}
