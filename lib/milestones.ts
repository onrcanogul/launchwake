import { db } from "./db";
import { env } from "./env";
import { sendEmail, emailConfigured } from "./notify";
import { unsubscribeUrl, emailFooter } from "./emailPrefs";

/**
 * Milestone notifications — the "it's working" dopamine hit that pulls a founder
 * back. Three moments worth an email: the first tracked CLICK, the first SIGNUP
 * from each channel, and every 10th signup overall. Batched to at most one email
 * per user per day (a busy launch can trip several at once — we lead with the best
 * and list the rest) and piggybacked on the reminders cron.
 *
 * Pure builders are unit-tested; the processor is driven by /api/cron/reminders.
 */

export type MilestoneKind = "FIRST_SIGNUP" | "SIGNUP_COUNT" | "FIRST_CLICK";

export type Milestone = {
  kind: MilestoneKind;
  /** Stable dedup discriminator: channel name, the count, or "" (see schema). */
  key: string;
  /** Human one-liner for the email body. */
  label: string;
};

/** Only whole tens are worth an email — the "every 10th signup" cadence. */
export const SIGNUP_MILESTONE_STEP = 10;
/** At most one milestone email per user per this window (task 2: "max 1/day"). */
export const MILESTONE_MIN_INTERVAL_MS = 24 * 60 * 60 * 1000;

export type MilestoneStats = {
  /** Total tracked clicks across all of the account's links. */
  clicks: number;
  /** Total link-attributed signups. */
  totalSignups: number;
  /** Signups grouped by channel name (only channels with ≥1 signup). */
  signupsByChannel: { channel: string; signups: number }[];
};

/**
 * Every milestone the account currently qualifies for, most-celebratory first
 * (first-signups, then the signup-count tens, then the first click). Pure — the
 * processor subtracts the ones already recorded to find what's newly earned.
 */
export function computeMilestones(stats: MilestoneStats): Milestone[] {
  const out: Milestone[] = [];

  // First signup from each channel — the headline example ("First signup from
  // Show HN"). Order by volume so the strongest channel leads a batch.
  const firstSignups = [...stats.signupsByChannel]
    .filter((c) => c.signups >= 1)
    .sort((a, b) => b.signups - a.signups || a.channel.localeCompare(b.channel));
  for (const c of firstSignups) {
    out.push({
      kind: "FIRST_SIGNUP",
      key: c.channel,
      label: `First signup from ${c.channel}`,
    });
  }

  // Every 10th signup overall (record the highest ten crossed; earlier tens were
  // recorded on prior runs, so the ledger dedups them).
  const crossed = Math.floor(stats.totalSignups / SIGNUP_MILESTONE_STEP) * SIGNUP_MILESTONE_STEP;
  if (crossed >= SIGNUP_MILESTONE_STEP) {
    out.push({
      kind: "SIGNUP_COUNT",
      key: String(crossed),
      label: `You passed ${crossed} signups`,
    });
  }

  // First tracked click — proof the link is live and people are moving.
  if (stats.clicks >= 1) {
    out.push({ kind: "FIRST_CLICK", key: "", label: "Your first tracked click landed" });
  }

  return out;
}

/** The subject headline for a milestone (the batch leads with the top one). */
export function milestoneSubject(m: Milestone): string {
  switch (m.kind) {
    case "FIRST_SIGNUP":
      return `First signup from ${m.key}`;
    case "SIGNUP_COUNT":
      return `You just passed ${m.key} signups`;
    case "FIRST_CLICK":
      return "Your first tracked click just landed";
  }
}

export type MilestoneEmail = { subject: string; text: string };

/**
 * One batched milestone email. `milestones` must be non-empty and pre-sorted
 * (most-celebratory first); the first is the subject, the rest join the body. Pure.
 */
export function buildMilestoneEmail(input: {
  projectName: string;
  appUrl: string;
  milestones: Milestone[];
  unsubscribeUrl: string;
}): MilestoneEmail {
  const base = input.appUrl.replace(/\/$/, "");
  const lead = input.milestones[0];

  const lines = [
    `Good news for ${input.projectName} — a milestone just landed.`,
    "",
    "WHAT JUST HAPPENED",
    ...input.milestones.map((m) => `  • ${m.label}`),
    "",
    "See which channels are actually converting, and double down on what works.",
    `Open Results → ${base}/app/results`,
    "",
    emailFooter(input.unsubscribeUrl),
  ];

  return { subject: milestoneSubject(lead), text: lines.join("\n") };
}

// ── Read side ──────────────────────────────────────────────

/** Account-wide click/signup tallies for milestone detection. */
export async function getMilestoneStats(accountId: string): Promise<MilestoneStats> {
  const posts = await db.post.findMany({
    where: { ship: { project: { userId: accountId } } },
    select: {
      channel: { select: { name: true } },
      trackedLink: { select: { events: { select: { type: true } } } },
    },
  });

  let clicks = 0;
  let totalSignups = 0;
  const byChannel = new Map<string, number>();
  for (const p of posts) {
    for (const e of p.trackedLink?.events ?? []) {
      if (e.type === "CLICK") clicks += 1;
      else if (e.type === "SIGNUP") {
        totalSignups += 1;
        byChannel.set(p.channel.name, (byChannel.get(p.channel.name) ?? 0) + 1);
      }
    }
  }

  return {
    clicks,
    totalSignups,
    signupsByChannel: [...byChannel.entries()].map(([channel, signups]) => ({ channel, signups })),
  };
}

export type MilestoneRunSummary = {
  processed: number;
  sent: number;
  skipped: number;
  failed: number;
  note?: string;
};

/**
 * Send batched milestone emails. For each opted-in owner not emailed a milestone
 * in the last day: compute earned milestones, drop the ones already in the ledger,
 * and if any remain send ONE email (best milestone as subject) and record them all.
 * Idempotent — the ledger's unique index makes a re-run a no-op. Never throws to
 * the caller. Ridealong on /api/cron/reminders.
 */
export async function processMilestones(now: Date = new Date()): Promise<MilestoneRunSummary> {
  if (!emailConfigured()) {
    return { processed: 0, sent: 0, skipped: 0, failed: 0, note: "email not configured" };
  }

  const guard = new Date(now.getTime() - MILESTONE_MIN_INTERVAL_MS);
  const owners = await db.user.findMany({
    where: {
      projects: { some: {} },
      emailNotifications: true,
      OR: [{ lastMilestoneAt: null }, { lastMilestoneAt: { lt: guard } }],
    },
    select: {
      id: true,
      email: true,
      projects: { orderBy: { createdAt: "asc" }, take: 1, select: { name: true } },
    },
  });

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const owner of owners) {
    const project = owner.projects[0];
    if (!project) {
      skipped += 1;
      continue;
    }
    try {
      const stats = await getMilestoneStats(owner.id);
      const earned = computeMilestones(stats);
      if (earned.length === 0) {
        skipped += 1;
        continue;
      }

      // Subtract already-recorded milestones (any of the three milestone kinds).
      const already = await db.lifecycleEmail.findMany({
        where: { userId: owner.id, kind: { in: ["FIRST_SIGNUP", "SIGNUP_COUNT", "FIRST_CLICK"] } },
        select: { kind: true, key: true },
      });
      const seen = new Set(already.map((r) => `${r.kind}:${r.key}`));
      const fresh = earned.filter((m) => !seen.has(`${m.kind}:${m.key}`));
      if (fresh.length === 0) {
        skipped += 1;
        continue;
      }

      const unsub = unsubscribeUrl(env.APP_URL, owner.id);
      const email = buildMilestoneEmail({
        projectName: project.name,
        appUrl: env.APP_URL,
        milestones: fresh,
        unsubscribeUrl: unsub,
      });
      const res = await sendEmail(owner.email, email.subject, email.text, { unsubscribeUrl: unsub });
      if (!res.ok) {
        failed += 1;
        continue;
      }

      // Record the batch + stamp the throttle. skipDuplicates guards a race with a
      // concurrent run so a milestone is never emailed twice.
      await db.lifecycleEmail.createMany({
        data: fresh.map((m) => ({ userId: owner.id, kind: m.kind, key: m.key, sentAt: now })),
        skipDuplicates: true,
      });
      await db.user.update({ where: { id: owner.id }, data: { lastMilestoneAt: now } });
      sent += 1;
    } catch {
      failed += 1;
    }
  }

  return { processed: owners.length, sent, skipped, failed };
}
