"use server";

import { randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
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

/** Generate (or rotate) the project's GitHub webhook signing secret. */
export async function generateWebhookSecret(): Promise<
  { ok: true; secret: string } | { ok: false; error: string }
> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const project = await db.project.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
  });
  if (!project) return { ok: false, error: "No project" };

  const secret = randomBytes(24).toString("hex");
  await db.project.update({
    where: { id: project.id },
    data: { webhookSecret: secret },
  });
  revalidatePath("/app/settings");
  return { ok: true, secret };
}

/** Save (or clear) the project's Slack incoming-webhook URL for reminders. */
export async function saveSlackWebhook(
  url: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const project = await db.project.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
  });
  if (!project) return { ok: false, error: "No project" };

  const trimmed = url.trim();
  if (trimmed && !/^https:\/\/hooks\.slack\.com\//.test(trimmed)) {
    return { ok: false, error: "Enter a valid Slack incoming-webhook URL." };
  }
  await db.project.update({
    where: { id: project.id },
    data: { slackWebhookUrl: trimmed || null },
  });
  revalidatePath("/app/settings");
  return { ok: true };
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
