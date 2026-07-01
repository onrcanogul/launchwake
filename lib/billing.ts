import Stripe from "stripe";
import { db } from "./db";
import { env, requireEnv } from "./env";

/**
 * Billing + entitlements.
 *
 * Entitlements are DB-only (plan + counts) so they enforce in every environment,
 * even without Stripe. Checkout/portal/webhook require STRIPE_SECRET_KEY and
 * degrade gracefully when it's absent.
 *
 * Free: 1 project, 2 distribution plans / calendar month. Pro: unlimited.
 */

export const PRO_PRICE_CENTS = 2900;

export const FREE_LIMITS = { projects: 1, plansPerMonth: 2 } as const;

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
  plan: "FREE" | "PRO";
  projectCount: number;
  projectLimit: number | null; // null = unlimited
  plansThisMonth: number;
  planLimit: number | null;
};

export async function getPlanUsage(userId: string): Promise<PlanUsage> {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { plan: true },
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

  const pro = user.plan === "PRO";
  return {
    plan: user.plan,
    projectCount,
    projectLimit: pro ? null : FREE_LIMITS.projects,
    plansThisMonth,
    planLimit: pro ? null : FREE_LIMITS.plansPerMonth,
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

/** Create a Checkout session for Pro; returns the redirect URL. */
export async function createCheckoutUrl(userId: string): Promise<string> {
  const customerId = await ensureCustomer(userId);
  const appUrl = env.APP_URL.replace(/\/$/, "");

  const session = await getStripe().checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: PRO_PRICE_CENTS,
          recurring: { interval: "month" },
          product_data: { name: "LaunchWake Pro" },
        },
      },
    ],
    success_url: `${appUrl}/app/settings?upgraded=1`,
    cancel_url: `${appUrl}/app/settings`,
    metadata: { userId },
    subscription_data: { metadata: { userId } },
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
      if (userId) {
        await db.user.update({
          where: { id: userId },
          data: { plan: "PRO", stripeCustomerId: customerId },
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
      const user = await db.user.findFirst({
        where: { stripeCustomerId: customerId },
      });
      if (user) {
        await db.user.update({
          where: { id: user.id },
          data: { plan: active ? "PRO" : "FREE" },
        });
      }
      break;
    }
    default:
      break;
  }
}
