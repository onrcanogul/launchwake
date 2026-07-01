"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { createCheckoutUrl, createPortalUrl, billingConfigured } from "@/lib/billing";

export type BillingState = { error?: string };

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user.id;
}

/** Start Pro checkout → returns the Stripe URL for the client to redirect to. */
export async function startCheckout(): Promise<BillingState & { url?: string }> {
  const userId = await requireUserId();
  if (!billingConfigured()) {
    return {
      error:
        "Billing isn't configured on this deployment (set STRIPE_SECRET_KEY).",
    };
  }
  try {
    const url = await createCheckoutUrl(userId);
    return { url };
  } catch (err) {
    return { error: `Could not start checkout: ${(err as Error).message}` };
  }
}

/** Open the Stripe billing portal → returns the URL. */
export async function openPortal(): Promise<BillingState & { url?: string }> {
  const userId = await requireUserId();
  if (!billingConfigured()) {
    return { error: "Billing isn't configured on this deployment." };
  }
  try {
    const url = await createPortalUrl(userId);
    return { url };
  } catch (err) {
    return { error: `Could not open billing portal: ${(err as Error).message}` };
  }
}
