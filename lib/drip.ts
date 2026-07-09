import { db } from "./db";
import { env } from "./env";
import { sendEmail, emailConfigured } from "./notify";
import { unsubscribeUrl, emailFooter } from "./emailPrefs";

/**
 * Activation drip — the first-week nudges that turn a signup into an activated
 * founder (CLAUDE.md: activation = seeing a real plan, then tracking, then
 * posting). Three steps, each sent at most once and only inside its age window:
 *
 *   day 0  welcome           — one clear next step
 *   day 2  pixel setup       — only if no tracking pixel is installed yet
 *   day 7  launch nudge      — only if nothing has been marked as posted
 *
 * The windows are what keep this safe to deploy: an account that predates the
 * feature is older than every window, so it is never back-blasted — only genuinely
 * new accounts flow through. Each step records a ledger row so it never repeats.
 *
 * Pure builders + the step-decision are unit-tested; the processor rides the
 * reminders cron.
 */

export type DripStep = "DRIP_WELCOME" | "DRIP_PIXEL" | "DRIP_LAUNCH";

const DAY_MS = 24 * 60 * 60 * 1000;

// Age windows (days). A step fires only while `min ≤ age < max`, so a missed step
// isn't sent weeks late and old accounts fall outside all of them.
export const WELCOME_MAX_AGE_DAYS = 2;
export const PIXEL_MIN_AGE_DAYS = 2;
export const PIXEL_MAX_AGE_DAYS = 5;
export const LAUNCH_MIN_AGE_DAYS = 7;
export const LAUNCH_MAX_AGE_DAYS = 10;

export type DripState = {
  /** Whole/fractional days since the account was created. */
  ageDays: number;
  /** Any of the owner's projects has a verified tracking pixel. */
  hasPixel: boolean;
  /** The owner has marked at least one channel as posted (any Post exists). */
  hasPublishedPost: boolean;
  /** Drip steps already sent (from the ledger). */
  alreadySent: DripStep[];
};

/**
 * The single drip step due right now, or null. Checked welcome → pixel → launch;
 * windows are disjoint so at most one ever applies. Pure + total, so it's the
 * whole testable core of the drip. `min ≤ age < max` bounds each step to its window.
 */
export function dueDripStep(s: DripState): DripStep | null {
  const sent = new Set(s.alreadySent);

  if (!sent.has("DRIP_WELCOME") && s.ageDays < WELCOME_MAX_AGE_DAYS) {
    return "DRIP_WELCOME";
  }
  if (
    !sent.has("DRIP_PIXEL") &&
    s.ageDays >= PIXEL_MIN_AGE_DAYS &&
    s.ageDays < PIXEL_MAX_AGE_DAYS &&
    !s.hasPixel
  ) {
    return "DRIP_PIXEL";
  }
  if (
    !sent.has("DRIP_LAUNCH") &&
    s.ageDays >= LAUNCH_MIN_AGE_DAYS &&
    s.ageDays < LAUNCH_MAX_AGE_DAYS &&
    !s.hasPublishedPost
  ) {
    return "DRIP_LAUNCH";
  }
  return null;
}

export type DripEmail = { subject: string; text: string };

type DripContext = {
  projectName: string;
  /** Owner's first name / display name, if known. */
  name?: string | null;
  appUrl: string;
  unsubscribeUrl: string;
};

/** Day 0: welcome + the one next step (see a real plan for your product). */
export function buildWelcomeEmail(ctx: DripContext): DripEmail {
  const base = ctx.appUrl.replace(/\/$/, "");
  const hi = ctx.name ? `Welcome, ${ctx.name}` : "Welcome to LaunchWake";
  const lines = [
    `${hi} — you're set up on LaunchWake.`,
    "",
    "For every ship you make, LaunchWake tells you where to post it — ranked by",
    "fit, with the rules, the ban risk, and the best time — then attributes the",
    "signups. You post it yourself; we never post for you.",
    "",
    "YOUR FIRST STEP",
    `  Add your product (or connect a GitHub repo) and we'll build your first`,
    `  distribution plan — a ranked place-by-place map for your next release.`,
    `  Start here → ${base}/app`,
    "",
    emailFooter(ctx.unsubscribeUrl),
  ];
  return { subject: "Welcome to LaunchWake — your first step", text: lines.join("\n") };
}

/** Day 2, no pixel: nudge to install tracking so signups are attributed. */
export function buildPixelSetupEmail(ctx: DripContext): DripEmail {
  const base = ctx.appUrl.replace(/\/$/, "");
  const lines = [
    `One thing left to make ${ctx.projectName}'s numbers real: signup tracking.`,
    "",
    "INSTALL THE TRACKING PIXEL",
    "  Drop one snippet on your signup success page and LaunchWake attributes every",
    "  signup back to the channel that drove it. Without it you see clicks but never",
    "  learn which post actually converts — the whole point of Results.",
    `  Setup guide → ${base}/app/settings`,
    "",
    emailFooter(ctx.unsubscribeUrl),
  ];
  return { subject: "Turn on signup tracking (2-minute setup)", text: lines.join("\n") };
}

/** Day 7, nothing posted: nudge to open the launch kit and ship it. */
export function buildLaunchNudgeEmail(ctx: DripContext): DripEmail {
  const base = ctx.appUrl.replace(/\/$/, "");
  const lines = [
    `A week in — ${ctx.projectName} hasn't posted anywhere yet. Shipped work`,
    "deserves an audience.",
    "",
    "OPEN YOUR LAUNCH KIT",
    "  Platform-native drafts, the safe way in for each channel, and the best time",
    "  to post — all queued and ready. You copy, paste, and post; LaunchWake handles",
    "  the where and the how.",
    `  Open your launch kit → ${base}/app`,
    "",
    emailFooter(ctx.unsubscribeUrl),
  ];
  return { subject: "Your launch kit is ready when you are", text: lines.join("\n") };
}

/** Render the email for a given step. Pure — the processor supplies context. */
export function buildDripEmail(step: DripStep, ctx: DripContext): DripEmail {
  switch (step) {
    case "DRIP_WELCOME":
      return buildWelcomeEmail(ctx);
    case "DRIP_PIXEL":
      return buildPixelSetupEmail(ctx);
    case "DRIP_LAUNCH":
      return buildLaunchNudgeEmail(ctx);
  }
}

export type DripRunSummary = {
  processed: number;
  sent: number;
  skipped: number;
  failed: number;
  note?: string;
};

/**
 * Send at most one activation-drip email per opted-in owner per run. Loads each
 * owner's age + pixel/post state + sent-ledger, asks dueDripStep which (if any)
 * step to send, delivers it, and records the row. Idempotent (the ledger dedups)
 * and never throws to the caller. Rides /api/cron/reminders.
 */
export async function processActivationDrip(now: Date = new Date()): Promise<DripRunSummary> {
  if (!emailConfigured()) {
    return { processed: 0, sent: 0, skipped: 0, failed: 0, note: "email not configured" };
  }

  // Only accounts young enough to still be in a window are candidates — this both
  // bounds the work and guarantees pre-existing accounts are never back-blasted.
  const oldest = new Date(now.getTime() - LAUNCH_MAX_AGE_DAYS * DAY_MS);
  const owners = await db.user.findMany({
    where: {
      projects: { some: {} },
      emailNotifications: true,
      createdAt: { gte: oldest },
    },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      projects: {
        orderBy: { createdAt: "asc" },
        select: { name: true, pixelVerifiedAt: true },
      },
      lifecycleEmails: {
        where: { kind: { in: ["DRIP_WELCOME", "DRIP_PIXEL", "DRIP_LAUNCH"] } },
        select: { kind: true },
      },
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
      const ageDays = (now.getTime() - owner.createdAt.getTime()) / DAY_MS;
      const hasPixel = owner.projects.some((p) => p.pixelVerifiedAt !== null);
      const hasPublishedPost =
        (await db.post.count({ where: { ship: { project: { userId: owner.id } } } })) > 0;
      const alreadySent = owner.lifecycleEmails.map((r) => r.kind as DripStep);

      const step = dueDripStep({ ageDays, hasPixel, hasPublishedPost, alreadySent });
      if (!step) {
        skipped += 1;
        continue;
      }

      const unsub = unsubscribeUrl(env.APP_URL, owner.id);
      const email = buildDripEmail(step, {
        projectName: project.name,
        name: owner.name,
        appUrl: env.APP_URL,
        unsubscribeUrl: unsub,
      });
      const res = await sendEmail(owner.email, email.subject, email.text, { unsubscribeUrl: unsub });
      if (!res.ok) {
        failed += 1;
        continue;
      }

      await db.lifecycleEmail.createMany({
        data: [{ userId: owner.id, kind: step, key: "", sentAt: now }],
        skipDuplicates: true,
      });
      sent += 1;
    } catch {
      failed += 1;
    }
  }

  return { processed: owners.length, sent, skipped, failed };
}
