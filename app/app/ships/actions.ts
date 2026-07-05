"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildPlan } from "@/lib/analysis";
import { generateDraft } from "@/lib/drafts";
import { isDraftTone, type DraftTone } from "@/lib/tones";
import { suggestShip, parseRepo } from "@/lib/github";
import { recordPostForRecommendation } from "@/lib/attribution";
import { resolveAccount } from "@/lib/team";
import { newReportToken, reportUrl } from "@/lib/report";
import { coachPost, type CoachResult } from "@/lib/coach";
import {
  assertEntitlement,
  EntitlementError,
  isPaidPlan,
  isLaunchChannelLocked,
} from "@/lib/billing";
import { nextBestTimeUTC } from "@/lib/reminders";
import { emailConfigured } from "@/lib/notify";
import { normalizeHttpUrl } from "@/lib/url";
import { fieldErrorsFromZod } from "@/lib/formErrors";
import { captureUser, EVENTS } from "@/lib/analytics";

async function requireProject() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { accountId } = await resolveAccount(session.user.id);
  const project = await db.project.findFirst({
    where: { userId: accountId },
    orderBy: { createdAt: "asc" },
  });
  if (!project) redirect("/onboarding");
  return project;
}

const CreateSchema = z.object({
  type: z.enum(["LAUNCH", "FEATURE", "BLOG", "OTHER"]),
  title: z.string().trim().min(3, "Give the ship a short title").max(200),
  summary: z.string().trim().max(2000).optional(),
  // Accept a bare domain or full URL (empty is fine — it's optional). A
  // non-empty value normalizes to a canonical http(s) URL or is a field error.
  sourceUrl: z
    .string()
    .trim()
    .max(500, "URL must be 500 characters or fewer")
    .optional()
    .or(z.literal(""))
    .transform((v, ctx) => {
      if (!v) return "";
      const normalized = normalizeHttpUrl(v);
      if (!normalized) {
        ctx.addIssue({ code: "custom", message: "Enter a valid URL" });
        return z.NEVER;
      }
      return normalized;
    }),
});

export type CreateShipState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

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
    const { fieldErrors, formError } = fieldErrorsFromZod(parsed.error);
    return { error: formError, fieldErrors };
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
  const project = await requireProject();
  // Drafting is the Pro-gated action in Launch Mode — a locked channel (past the
  // Free cap) is skipped even if called directly. project.userId is the accountId.
  if (await isLaunchChannelLocked(recommendationId, project.userId)) return;
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
  const { accountId } = await resolveAccount(session.user.id);

  const rec = await db.recommendation.findFirst({
    where: {
      id: recommendationId,
      plan: { ship: { project: { userId: accountId } } },
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

/** Sentinel channelName for the single D-1 launch reminder (so re-scheduling replaces it). */
const LAUNCH_REMINDER_CHANNEL = "your launch channels";

const ScheduleLaunchSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a launch date"),
  method: z.enum(["EMAIL", "SLACK"]).optional(),
});

export type ScheduleLaunchState =
  | { ok: true; launchAt: string; reminderSet: boolean }
  | { ok: false; error: string };

/**
 * Set a ship's launch date (Launch Mode) and (re)create the D-1 reminder. The
 * D-7..D+2 schedule + ICS are derived from launchAt on the schedule page; this
 * only persists the date and the day-before nudge. `method` is optional — when
 * omitted (or its transport isn't configured) we still set the date and skip
 * the reminder. Never posts.
 */
export async function scheduleLaunch(
  shipId: string,
  date: string,
  method?: "EMAIL" | "SLACK",
): Promise<ScheduleLaunchState> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { accountId } = await resolveAccount(session.user.id);

  const parsed = ScheduleLaunchSchema.safeParse({ date, method });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const ship = await db.ship.findFirst({
    where: { id: shipId, project: { userId: accountId } },
    include: { project: true },
  });
  if (!ship) return { ok: false, error: "Ship not found" };

  if (parsed.data.method === "EMAIL" && !emailConfigured()) {
    return { ok: false, error: "Email isn't configured on this deployment yet." };
  }
  if (parsed.data.method === "SLACK" && !ship.project.slackWebhookUrl) {
    return { ok: false, error: "Add a Slack webhook in Settings first." };
  }

  // Anchor the launch at 09:00 UTC on the chosen day (a definite instant).
  const launchAt = new Date(`${parsed.data.date}T09:00:00.000Z`);
  if (Number.isNaN(launchAt.getTime())) {
    return { ok: false, error: "Invalid date" };
  }

  await db.ship.update({ where: { id: ship.id }, data: { launchAt } });

  // Replace any prior D-1 reminder for this launch, then create a fresh one
  // (only when a delivery method is available).
  await db.reminder.deleteMany({
    where: {
      shipId: ship.id,
      channelName: LAUNCH_REMINDER_CHANNEL,
      status: "PENDING",
    },
  });
  let reminderSet = false;
  if (parsed.data.method) {
    const sendAt = new Date(launchAt.getTime() - 24 * 60 * 60 * 1000);
    await db.reminder.create({
      data: {
        userId: session.user.id,
        shipId: ship.id,
        channelName: LAUNCH_REMINDER_CHANNEL,
        shipTitle: ship.title,
        bestTimeLabel: "launch is tomorrow",
        ruleNote:
          "Final checks: drafts ready, tracking snippet live, first-comment links prepped. Post tomorrow at each channel's best time.",
        method: parsed.data.method,
        sendAt,
      },
    });
    reminderSet = true;
  }

  revalidatePath("/app/ships");
  revalidatePath("/app");
  return { ok: true, launchAt: launchAt.toISOString(), reminderSet };
}

export type CompleteLaunchState = { ok: boolean; error?: string };

/**
 * Finish Launch Mode: flip the project to LAUNCHED so it flows into Growth Mode
 * (the every-ship cadence), and mark the launch ship done. Idempotent.
 */
export async function completeLaunch(
  shipId: string,
): Promise<CompleteLaunchState> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { accountId } = await resolveAccount(session.user.id);

  const ship = await db.ship.findFirst({
    where: { id: shipId, project: { userId: accountId } },
    select: { id: true, projectId: true },
  });
  if (!ship) return { ok: false, error: "Ship not found" };

  await db.project.update({
    where: { id: ship.projectId },
    data: { launchStage: "LAUNCHED" },
  });
  await db.ship.update({ where: { id: ship.id }, data: { status: "DONE" } });

  revalidatePath("/app", "layout");
  return { ok: true };
}

export type MarkPostedState =
  | { ok: true; trackedUrl: string }
  | { ok: false; error: string };

/** Record that the user posted a channel and mint its tracked link. */
export async function markPosted(
  recommendationId: string,
  postedUrl?: string,
): Promise<MarkPostedState> {
  const project = await requireProject();
  try {
    const res = await recordPostForRecommendation(recommendationId, postedUrl);
    revalidatePath("/app");
    revalidatePath("/app/results");
    revalidatePath("/app/ships");
    // Funnel: the human posted and got a tracked link — attribution can begin.
    after(() => captureUser(project.userId, EVENTS.shipMarkedPosted));
    return { ok: true, trackedUrl: res.trackedUrl };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

// ── Public launch report (viral loop) ──────────────────────

/** Load a ship owned by the current user, or throw. */
async function requireOwnedShip(shipId: string) {
  const project = await requireProject();
  const ship = await db.ship.findFirst({
    where: { id: shipId, projectId: project.id },
    select: { id: true, publicToken: true, publicShowRevenue: true },
  });
  if (!ship) throw new Error("Ship not found");
  return ship;
}

export type ReportState =
  | { ok: true; token: string | null; url: string | null; showRevenue: boolean }
  | { ok: false; error: string };

/** Turn the public report on (minting a token if needed) or off. */
export async function setPublicReport(
  shipId: string,
  makePublic: boolean,
): Promise<ReportState> {
  try {
    const ship = await requireOwnedShip(shipId);
    let token = ship.publicToken;
    if (makePublic) {
      token = token ?? newReportToken();
      await db.ship.update({ where: { id: shipId }, data: { publicToken: token } });
    } else {
      await db.ship.update({ where: { id: shipId }, data: { publicToken: null } });
      token = null;
    }
    revalidatePath(`/app/ships/${shipId}/launch`);
    return {
      ok: true,
      token,
      url: token ? reportUrl(token) : null,
      showRevenue: ship.publicShowRevenue,
    };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/** Toggle whether the public report shows revenue (off by default — sensitive). */
export async function setReportRevenue(
  shipId: string,
  showRevenue: boolean,
): Promise<ReportState> {
  try {
    const ship = await requireOwnedShip(shipId);
    await db.ship.update({ where: { id: shipId }, data: { publicShowRevenue: showRevenue } });
    revalidatePath(`/app/ships/${shipId}/launch`);
    return {
      ok: true,
      token: ship.publicToken,
      url: ship.publicToken ? reportUrl(ship.publicToken) : null,
      showRevenue,
    };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

// ── Post-mortem coaching (Pro / Team) ──────────────────────

export type CoachState =
  | { ok: true; result: CoachResult }
  | { ok: false; locked?: boolean; error: string };

/** Diagnose a post from its text + rules + real outcome. Paid feature. */
export async function coachPostAction(postId: string): Promise<CoachState> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { accountId } = await resolveAccount(session.user.id);

  // Ownership: the post must belong to this account's workspace.
  const owned = await db.post.findFirst({
    where: { id: postId, ship: { project: { userId: accountId } } },
    select: { id: true },
  });
  if (!owned) return { ok: false, error: "Post not found" };

  const account = await db.user.findUnique({ where: { id: accountId }, select: { plan: true } });
  if (!account || !isPaidPlan(account.plan)) {
    return {
      ok: false,
      locked: true,
      error: "Post-mortem coaching is a Pro feature — upgrade to turn your outcomes into concrete fixes.",
    };
  }

  try {
    const result = await coachPost(postId);
    revalidatePath("/app/results");
    return { ok: true, result };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
