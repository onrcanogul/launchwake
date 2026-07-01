"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildPlan } from "@/lib/analysis";
import { generateDraft, isDraftTone, type DraftTone } from "@/lib/drafts";
import { suggestShip, parseRepo } from "@/lib/github";
import { recordPostForRecommendation } from "@/lib/attribution";
import { assertEntitlement, EntitlementError } from "@/lib/billing";
import { nextBestTimeUTC } from "@/lib/reminders";
import { emailConfigured } from "@/lib/notify";

async function requireProject() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const project = await db.project.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
  });
  if (!project) redirect("/onboarding");
  return project;
}

const CreateSchema = z.object({
  type: z.enum(["LAUNCH", "FEATURE", "BLOG", "OTHER"]),
  title: z.string().trim().min(3, "Give the ship a short title").max(200),
  summary: z.string().trim().max(2000).optional(),
  sourceUrl: z
    .string()
    .trim()
    .url("Enter a valid URL")
    .optional()
    .or(z.literal("")),
});

export type CreateShipState = { error?: string };

/** Create a ship, build its distribution plan, then land on the plan (the aha). */
export async function createShipAndPlan(
  _prev: CreateShipState,
  formData: FormData,
): Promise<CreateShipState> {
  const project = await requireProject();

  const parsed = CreateSchema.safeParse({
    type: formData.get("type"),
    title: formData.get("title"),
    summary: formData.get("summary") || undefined,
    sourceUrl: formData.get("sourceUrl") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  // Free-plan gate: 2 distribution plans / month.
  try {
    await assertEntitlement(project.userId, "create_plan");
  } catch (err) {
    if (err instanceof EntitlementError) return { error: err.message };
    throw err;
  }

  let shipId: string;
  try {
    const ship = await db.ship.create({
      data: {
        projectId: project.id,
        type: parsed.data.type,
        title: parsed.data.title,
        summary: parsed.data.summary || null,
        sourceUrl: parsed.data.sourceUrl || null,
      },
    });
    shipId = ship.id;
    await buildPlan(shipId);
  } catch (err) {
    return { error: `Could not build a plan: ${(err as Error).message}` };
  }

  revalidatePath("/app", "layout"); // refresh the cached shell (ship switcher list)
  redirect(`/app/ships/${shipId}/plan`);
}

/** Re-run analysis for an existing ship. */
export async function rerunPlan(shipId: string): Promise<void> {
  await requireProject();
  await buildPlan(shipId);
  revalidatePath(`/app/ships/${shipId}/plan`);
}

/**
 * Build the plan for a ship only if it doesn't have one yet (idempotent). Used by
 * the first-run auto-analysis so the user lands straight on their first plan.
 */
export async function ensurePlan(
  shipId: string,
): Promise<{ ok: boolean; error?: string }> {
  const project = await requireProject();
  const ship = await db.ship.findFirst({
    where: { id: shipId, projectId: project.id },
    include: { plan: { select: { id: true } } },
  });
  if (!ship) return { ok: false, error: "Ship not found" };
  if (ship.plan) return { ok: true };

  try {
    await assertEntitlement(project.userId, "create_plan");
  } catch (err) {
    if (err instanceof EntitlementError) return { ok: false, error: err.message };
    throw err;
  }

  try {
    await buildPlan(shipId);
  } catch (err) {
    return { ok: false, error: `Could not build a plan: ${(err as Error).message}` };
  }
  revalidatePath(`/app/ships/${shipId}/plan`);
  return { ok: true };
}

export type PullState =
  | { ok: true; type: string; title: string; summary: string; sourceUrl: string }
  | { ok: false; error: string };

/** Pull the latest release/commit from the connected repo to prefill the form. */
export async function pullLatestShip(): Promise<PullState> {
  const project = await requireProject();
  if (!project.githubRepo) {
    return { ok: false, error: "No GitHub repo connected for this project." };
  }
  const ref = parseRepo(project.githubRepo);
  if (!ref) return { ok: false, error: "Connected repo is not a valid owner/repo." };

  try {
    const suggestion = await suggestShip(ref);
    if (!suggestion) {
      return {
        ok: false,
        error: "No releases or commits found on the connected repo.",
      };
    }
    return {
      ok: true,
      type: suggestion.type,
      title: suggestion.title,
      summary: suggestion.summary ?? "",
      sourceUrl: suggestion.sourceUrl ?? "",
    };
  } catch (err) {
    return { ok: false, error: `GitHub fetch failed: ${(err as Error).message}` };
  }
}

/** Generate (or regenerate) the draft for a recommendation, used by Launch kit. */
export async function ensureDraft(
  recommendationId: string,
  tone?: string,
): Promise<void> {
  await requireProject();
  const t: DraftTone = isDraftTone(tone) ? tone : "founder";
  await generateDraft(recommendationId, t);
  revalidatePath("/app/ships");
}

export type ScheduleReminderState =
  | { ok: true; sendAt: string; method: "EMAIL" | "SLACK" }
  | { ok: false; error: string };

/** Schedule an email/Slack ping at the channel's best time (never auto-posts). */
export async function scheduleReminder(
  recommendationId: string,
  method: "EMAIL" | "SLACK",
): Promise<ScheduleReminderState> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const rec = await db.recommendation.findFirst({
    where: {
      id: recommendationId,
      plan: { ship: { project: { userId: session.user.id } } },
    },
    include: {
      channel: true,
      plan: { include: { ship: { include: { project: true } } } },
    },
  });
  if (!rec) return { ok: false, error: "Recommendation not found" };

  const ship = rec.plan.ship;
  const project = ship.project;

  if (method === "EMAIL" && !emailConfigured()) {
    return { ok: false, error: "Email isn't configured on this deployment yet." };
  }
  if (method === "SLACK" && !project.slackWebhookUrl) {
    return { ok: false, error: "Add a Slack webhook in Settings first." };
  }

  const bestTime = rec.bestTime ?? rec.channel.bestTime;
  const sendAt = nextBestTimeUTC(bestTime, new Date());
  if (!sendAt) {
    return { ok: false, error: "This channel has no scheduled best time." };
  }

  await db.reminder.create({
    data: {
      userId: session.user.id,
      shipId: ship.id,
      channelName: rec.channel.name,
      shipTitle: ship.title,
      bestTimeLabel: bestTime,
      ruleNote: rec.ruleNote,
      method,
      sendAt,
    },
  });

  return { ok: true, sendAt: sendAt.toISOString(), method };
}

export type MarkPostedState =
  | { ok: true; trackedUrl: string }
  | { ok: false; error: string };

/** Record that the user posted a channel and mint its tracked link. */
export async function markPosted(
  recommendationId: string,
  postedUrl?: string,
): Promise<MarkPostedState> {
  await requireProject();
  try {
    const res = await recordPostForRecommendation(recommendationId, postedUrl);
    revalidatePath("/app");
    revalidatePath("/app/results");
    revalidatePath("/app/ships");
    return { ok: true, trackedUrl: res.trackedUrl };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
