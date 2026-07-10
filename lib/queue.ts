import { db } from "./db";
import { matchChannels } from "./channels";
import { getProjectTagContext } from "./projectTags";
import type { QueuePhase, QueueTaskStatus } from "@prisma/client";

/**
 * Distribution queue — the anti-churn cadence.
 *
 * A launch isn't a day, it's a sequence. When a ship's plan is built we lay down
 * a dated queue: announce the changelog on day 0, submit to directories in week
 * 1, pitch newsletters in week 2, hit niche subreddits in week 3, and relaunch
 * on Show HN at ~month 3. The weekly digest surfaces whatever is due ("this
 * week's 3 tasks"), so the answer to "my launch is over, now what?" is always
 * waiting. The human still posts everything — we only schedule and remind.
 *
 * Channel selection is grounded in the seeded catalog (matchChannels), never
 * invented. Pure schedulers are unit-tested; the rest is thin DB glue.
 */

export const PHASE_ORDER: QueuePhase[] = [
  "CHANGELOG",
  "DIRECTORIES",
  "NEWSLETTERS",
  "SUBREDDITS",
  "SHOW_HN_RELAUNCH",
];

export type PhaseSpec = {
  phase: QueuePhase;
  platforms: string[]; // catalog platforms that belong to this phase
  offsetDays: number; // days after the ship start
  cap: number; // max channels queued for this phase
  label: string; // action label
  blurb: string; // one-liner shown in the UI
  weekLabel: string; // human timing ("Week 1", "~Month 3")
};

export const PHASES: Record<QueuePhase, PhaseSpec> = {
  CHANGELOG: {
    phase: "CHANGELOG",
    platforms: ["DEVTO", "BLOG"],
    offsetDays: 0,
    cap: 2,
    label: "Announce the release",
    blurb: "Post the changelog where your existing readers already are.",
    weekLabel: "On release",
  },
  DIRECTORIES: {
    phase: "DIRECTORIES",
    platforms: ["DIRECTORY"],
    offsetDays: 2,
    cap: 4,
    label: "Submit to directories",
    blurb: "Evergreen backlinks and long-tail discovery — submit once, ranks for months.",
    weekLabel: "Week 1",
  },
  NEWSLETTERS: {
    phase: "NEWSLETTERS",
    platforms: ["NEWSLETTER"],
    offsetDays: 9,
    cap: 3,
    label: "Pitch newsletters",
    blurb: "One good newsletter mention beats a week of posting.",
    weekLabel: "Week 2",
  },
  SUBREDDITS: {
    phase: "SUBREDDITS",
    platforms: ["REDDIT"],
    offsetDays: 16,
    cap: 3,
    label: "Post in niche communities",
    blurb: "Smaller, on-topic subreddits convert far better than the big defaults.",
    weekLabel: "Week 3",
  },
  SHOW_HN_RELAUNCH: {
    phase: "SHOW_HN_RELAUNCH",
    platforms: ["HACKERNEWS"],
    offsetDays: 90,
    cap: 1,
    label: "Show HN relaunch",
    blurb: "Three months of progress is a fresh, legitimate Show HN.",
    weekLabel: "~Month 3",
  },
};

// ── Pure: scheduling ───────────────────────────────────────
export function addDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * 86_400_000);
}

export type CadenceTaskSpec = { channelId: string; phase: QueuePhase; dueAt: Date };

/**
 * Given the ship's start date and the channels chosen for each phase, produce
 * dated task specs (capped per phase, in phase order). Pure → unit-testable.
 */
export function buildCadence(
  start: Date,
  perPhase: Partial<Record<QueuePhase, { id: string }[]>>,
): CadenceTaskSpec[] {
  const out: CadenceTaskSpec[] = [];
  for (const phase of PHASE_ORDER) {
    const spec = PHASES[phase];
    const chans = (perPhase[phase] ?? []).slice(0, spec.cap);
    for (const c of chans) {
      out.push({ channelId: c.id, phase, dueAt: addDays(start, spec.offsetDays) });
    }
  }
  return out;
}

/** Human "when" for a task relative to now. Pure. */
export function dueLabel(dueAt: Date, now: Date = new Date()): string {
  const days = Math.round((dueAt.getTime() - now.getTime()) / 86_400_000);
  if (days <= -1) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days <= 7) return `Due in ${days}d`;
  const weeks = Math.round(days / 7);
  return weeks <= 8 ? `In ~${weeks}w` : `In ~${Math.round(days / 30)}mo`;
}

// ── Generate (called after a plan is built) ────────────────
export async function generateQueueForShip(shipId: string): Promise<{ tasks: number }> {
  const ship = await db.ship.findUnique({
    where: { id: shipId },
    include: {
      project: {
        select: {
          id: true,
          userId: true,
          name: true,
          description: true,
          url: true,
          classificationJson: true,
          classificationHash: true,
        },
      },
    },
  });
  if (!ship) return { tasks: 0 };

  const catalog = await db.channel.findMany();
  // Shared fit-context (cache-only — the queue is generated right after buildPlan
  // has already classified + cached, so this hits the cache; it keeps short-form
  // channels in the queue consistent with the plan without a second LLM call).
  const { ctx } = await getProjectTagContext(ship.project, {
    ship,
    classifyOnMiss: false,
  });

  const perPhase: Partial<Record<QueuePhase, { id: string }[]>> = {};
  for (const phase of PHASE_ORDER) {
    const spec = PHASES[phase];
    const filtered = catalog.filter((c) => spec.platforms.includes(c.platform));
    if (filtered.length === 0) continue;
    perPhase[phase] = matchChannels(filtered, ctx, spec.cap).map((r) => ({ id: r.channel.id }));
  }

  const specs = buildCadence(ship.detectedAt, perPhase);
  let created = 0;
  for (const s of specs) {
    try {
      // Idempotent: a re-run keeps any existing task (and its DONE/SKIPPED status).
      await db.queueTask.create({
        data: { shipId, channelId: s.channelId, phase: s.phase, dueAt: s.dueAt },
      });
      created += 1;
    } catch (err) {
      if ((err as { code?: string }).code !== "P2002") throw err;
    }
  }
  return { tasks: created };
}

// ── Read model ─────────────────────────────────────────────
export type QueueTaskView = {
  id: string;
  phase: QueuePhase;
  channelName: string;
  channelSlug: string;
  platform: string;
  channelUrl: string | null;
  rules: string | null;
  dueAt: Date;
  status: QueueTaskStatus;
};

export type QueuePhaseGroup = {
  phase: QueuePhase;
  label: string;
  blurb: string;
  weekLabel: string;
  tasks: QueueTaskView[];
};

/** A ship's queue, grouped by phase in cadence order. */
export async function getShipQueue(shipId: string): Promise<QueuePhaseGroup[]> {
  const tasks = await db.queueTask.findMany({
    where: { shipId },
    include: { channel: { select: { name: true, slug: true, platform: true, url: true, rules: true } } },
    orderBy: [{ dueAt: "asc" }],
  });

  return PHASE_ORDER.map((phase) => {
    const spec = PHASES[phase];
    return {
      phase,
      label: spec.label,
      blurb: spec.blurb,
      weekLabel: spec.weekLabel,
      tasks: tasks
        .filter((t) => t.phase === phase)
        .map((t) => ({
          id: t.id,
          phase: t.phase,
          channelName: t.channel.name,
          channelSlug: t.channel.slug,
          platform: t.channel.platform,
          channelUrl: t.channel.url,
          rules: t.channel.rules,
          dueAt: t.dueAt,
          status: t.status,
        })),
    };
  }).filter((g) => g.tasks.length > 0);
}

// ── Digest: what's due this week ───────────────────────────
export type DueTask = {
  phase: QueuePhase;
  phaseLabel: string;
  channelName: string;
  shipTitle: string;
  url: string | null;
  dueAt: Date;
};

/**
 * Pending tasks coming due within the next 7 days for an account, soonest first.
 * This is the digest's "this week's tasks".
 */
export async function tasksDueThisWeek(
  accountId: string,
  now: Date = new Date(),
  limit = 3,
): Promise<DueTask[]> {
  const horizon = addDays(now, 7);
  const tasks = await db.queueTask.findMany({
    where: {
      status: "PENDING",
      dueAt: { lte: horizon },
      ship: { project: { userId: accountId } },
    },
    include: {
      channel: { select: { name: true, url: true } },
      ship: { select: { title: true } },
    },
    orderBy: { dueAt: "asc" },
    take: limit,
  });
  return tasks.map((t) => ({
    phase: t.phase,
    phaseLabel: PHASES[t.phase].label,
    channelName: t.channel.name,
    shipTitle: t.ship.title,
    url: t.channel.url,
    dueAt: t.dueAt,
  }));
}

// ── Mutations (owner-scoped) ───────────────────────────────
async function assertTaskOwned(taskId: string, accountId: string): Promise<void> {
  const t = await db.queueTask.findFirst({
    where: { id: taskId, ship: { project: { userId: accountId } } },
    select: { id: true },
  });
  if (!t) throw new Error("Task not found.");
}

export async function setTaskStatus(
  taskId: string,
  accountId: string,
  status: QueueTaskStatus,
): Promise<void> {
  await assertTaskOwned(taskId, accountId);
  await db.queueTask.update({
    where: { id: taskId },
    data: { status, doneAt: status === "DONE" ? new Date() : null },
  });
}
