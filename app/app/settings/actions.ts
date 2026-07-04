"use server";

import { randomBytes } from "crypto";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createCheckoutUrl, createPortalUrl, billingConfigured } from "@/lib/billing";
import {
  resolveAccount,
  createInvite,
  revokeInvite,
  removeMember,
  type InviteResult,
} from "@/lib/team";
import { saveBrand, setReportEnabled } from "@/lib/clientReport";
import { normalizeHttpUrl } from "@/lib/url";

// White-label brand input. logoUrl is https-only (normalized, then required to be
// https); accentColor is a #rrggbb hex. The lib sanitizers re-check on write as
// defense-in-depth.
const BrandSchema = z.object({
  agencyName: z.string().trim().min(1, "Agency name is required.").max(80),
  logoUrl: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .transform((v, ctx) => {
      if (!v) return null;
      const normalized = normalizeHttpUrl(v);
      if (!normalized || !normalized.startsWith("https://")) {
        ctx.addIssue({ code: "custom", message: "Logo URL must be an https:// URL." });
        return z.NEVER;
      }
      return normalized;
    }),
  accentColor: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .transform((v, ctx) => {
      if (!v) return null;
      const m = /^#?([0-9a-fA-F]{6})$/.exec(v);
      if (!m) {
        ctx.addIssue({ code: "custom", message: "Accent must be a #rrggbb hex colour." });
        return z.NEVER;
      }
      return `#${m[1].toLowerCase()}`;
    }),
});

const InviteEmailSchema = z.string().trim().toLowerCase().email().max(254);

export type BillingState = { error?: string };

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user.id;
}

/** Resolve the caller and ensure they OWN the account (not a member seat). */
async function requireOwner(): Promise<string> {
  const userId = await requireUserId();
  const { accountId, role } = await resolveAccount(userId);
  if (role !== "OWNER") {
    throw new Error("Only the team owner can manage seats.");
  }
  return accountId;
}

/** Owner AND on the Team plan — the gate for white-label features. */
async function requireTeamOwner(): Promise<string> {
  const accountId = await requireOwner();
  const owner = await db.user.findUniqueOrThrow({
    where: { id: accountId },
    select: { plan: true },
  });
  if (owner.plan !== "TEAM") throw new Error("White-label reports are a Team feature.");
  return accountId;
}

export type BrandState = { ok: boolean; error?: string };

/** Save the agency's white-label brand (name, logo, accent). */
export async function saveAgencyBrand(
  _prev: BrandState,
  formData: FormData,
): Promise<BrandState> {
  try {
    const accountId = await requireTeamOwner();
    const parsed = BrandSchema.safeParse({
      agencyName: formData.get("agencyName"),
      logoUrl: formData.get("logoUrl") || undefined,
      accentColor: formData.get("accentColor") || undefined,
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
    }
    await saveBrand(accountId, {
      agencyName: parsed.data.agencyName,
      logoUrl: parsed.data.logoUrl,
      accentColor: parsed.data.accentColor,
    });
    revalidatePath("/app/settings");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/** Enable/disable a project's client report link. */
export async function toggleClientReport(
  projectId: string,
  enabled: boolean,
): Promise<{ ok: boolean; token?: string | null; error?: string }> {
  try {
    const accountId = await requireTeamOwner();
    const { token } = await setReportEnabled(projectId, accountId, enabled);
    revalidatePath("/app/settings");
    return { ok: true, token };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

// ── Team management (owner only) ───────────────────────────

/** Invite a teammate to a Team seat → returns the invite link. */
export async function inviteTeamMember(email: string): Promise<InviteResult> {
  try {
    const ownerId = await requireOwner();
    const parsed = InviteEmailSchema.safeParse(email);
    if (!parsed.success) {
      return { ok: false, error: "Enter a valid email address." };
    }
    const res = await createInvite(ownerId, parsed.data);
    if (res.ok) revalidatePath("/app/settings");
    return res;
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/** Revoke a pending invite. */
export async function revokeTeamInvite(inviteId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const ownerId = await requireOwner();
    await revokeInvite(ownerId, inviteId);
    revalidatePath("/app/settings");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/** Remove a member from the team (frees their seat). */
export async function removeTeamMember(memberId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const ownerId = await requireOwner();
    await removeMember(ownerId, memberId);
    revalidatePath("/app/settings");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/** Leave the team you're a member of (a member action, not the owner). */
export async function leaveTeam(): Promise<{ ok: boolean; error?: string }> {
  try {
    const userId = await requireUserId();
    await db.teamMembership.deleteMany({ where: { memberId: userId } });
    revalidatePath("/app", "layout");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
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

/** Start Team checkout for `seats` seats → returns the Stripe URL. */
export async function startTeamCheckout(
  seats: number,
): Promise<BillingState & { url?: string }> {
  const userId = await requireUserId();
  if (!billingConfigured()) {
    return {
      error:
        "Billing isn't configured on this deployment (set STRIPE_SECRET_KEY).",
    };
  }
  try {
    const url = await createCheckoutUrl(userId, { plan: "TEAM", seats });
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

/** Save (or clear) the project's Stripe endpoint signing secret for revenue attribution. */
export async function saveStripeWebhookSecret(
  secret: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const project = await db.project.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
  });
  if (!project) return { ok: false, error: "No project" };

  const trimmed = secret.trim();
  if (trimmed && !/^whsec_/.test(trimmed)) {
    return { ok: false, error: "Paste the endpoint's signing secret (starts with whsec_)." };
  }
  await db.project.update({
    where: { id: project.id },
    data: { stripeWebhookSecret: trimmed || null },
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
