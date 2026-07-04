import { db } from "./db";
import { env } from "./env";

/**
 * Tracking health — the observability surface for ingestion. A founder must be
 * able to tell "no signups from this channel" (a real outcome) apart from "my
 * pixel isn't installed" or "the webhook is failing" (a plumbing problem that
 * makes a working channel look dead). `getTrackingHealth` gathers the raw
 * signals; `deriveTrackingHealth` is pure so its status logic is unit-testable.
 */

export type HealthLevel = "green" | "amber" | "red";

export type HealthItemKey = "pixel" | "clicks" | "github" | "stripe" | "deliveries";

export type HealthItem = {
  key: HealthItemKey;
  label: string;
  level: HealthLevel;
  /** Short right-aligned status word (e.g. "Receiving", "Action needed"). */
  status: string;
  /** Plain-language current state. */
  detail: string;
  /** Plain-language fix instruction, present when the item isn't green. */
  fix?: string;
};

export type TrackingHealthSignals = {
  signups: number;
  clicks: number;
  lastSignupAt: Date | null;
  lastClickAt: Date | null;
  githubConfigured: boolean;
  githubLastSuccessAt: Date | null;
  stripeConfigured: boolean;
  stripeLastSuccessAt: Date | null;
  /** FAILED GitHub deliveries in the last 24h. */
  recentFailedGithub: number;
  /** FAILED Stripe deliveries in the last 24h. */
  recentFailedStripe: number;
  now: Date;
};

export type TrackingHealth = {
  overall: HealthLevel;
  items: HealthItem[];
  // Raw signals (also exposed for callers that need the numbers directly).
  pixelInstalled: boolean;
  lastClickAt: Date | null;
  lastSignupAt: Date | null;
  githubLastSuccessAt: Date | null;
  stripeLastSuccessAt: Date | null;
  recentFailedDeliveries: number;
  /** Drives the Results-page banner: real webhook failures in the last 24h. */
  hasRedWebhookFailures: boolean;
};

export const FAILED_DELIVERY_WINDOW_MS = 24 * 60 * 60 * 1000;

const RANK: Record<HealthLevel, number> = { green: 0, amber: 1, red: 2 };

/** Compact relative time — pure, deterministic given (date, now). */
export function relTime(date: Date, now: Date): string {
  const secs = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));
  const mins = Math.floor(secs / 60);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (days >= 1) return days === 1 ? "1 day ago" : `${days} days ago`;
  if (hours >= 1) return `${hours}h ago`;
  if (mins >= 1) return `${mins}m ago`;
  return "just now";
}

/**
 * Derive per-item and overall tracking health from raw signals. Pure — no I/O.
 */
export function deriveTrackingHealth(s: TrackingHealthSignals): TrackingHealth {
  const items: HealthItem[] = [];

  // 1 — Signup pixel: the classic silent failure. Clicks arriving with zero
  // signups almost always means the pixel isn't on the thank-you page.
  if (s.signups > 0) {
    items.push({
      key: "pixel",
      label: "Signup pixel",
      level: "green",
      status: "Receiving",
      detail: `${s.signups} signup${s.signups === 1 ? "" : "s"} attributed${
        s.lastSignupAt ? `, last ${relTime(s.lastSignupAt, s.now)}` : ""
      }.`,
    });
  } else if (s.clicks > 0) {
    items.push({
      key: "pixel",
      label: "Signup pixel",
      level: "red",
      status: "Action needed",
      detail: `${s.clicks} click${s.clicks === 1 ? "" : "s"} tracked but no signups recorded.`,
      fix: "No signup events yet — install the pixel on your thank-you page and call launchwakeSignup() there.",
    });
  } else {
    items.push({
      key: "pixel",
      label: "Signup pixel",
      level: "amber",
      status: "Waiting",
      detail: "No signup events yet.",
      fix: "Add the LaunchWake pixel to your site so signups get attributed to a channel.",
    });
  }

  // 2 — Click tracking: informational (never red on its own).
  if (s.clicks > 0) {
    items.push({
      key: "clicks",
      label: "Click tracking",
      level: "green",
      status: "Tracking",
      detail: `${s.clicks} click${s.clicks === 1 ? "" : "s"} logged${
        s.lastClickAt ? `, last ${relTime(s.lastClickAt, s.now)}` : ""
      }.`,
    });
  } else {
    items.push({
      key: "clicks",
      label: "Click tracking",
      level: "amber",
      status: "Waiting",
      detail: "No tracked-link clicks yet.",
      fix: "Mark a ship as posted to mint a tracked link, then share that link.",
    });
  }

  // 3 — GitHub webhook.
  items.push(
    webhookItem({
      key: "github",
      label: "GitHub webhook",
      configured: s.githubConfigured,
      recentFailed: s.recentFailedGithub,
      lastSuccessAt: s.githubLastSuccessAt,
      now: s.now,
      notConnectedFix:
        "Connect a repo and add the webhook so new releases and commits auto-create ships.",
      waitingDetail: "Connected — waiting for the first push or release.",
      waitingFix: "Push to your default branch or publish a release to verify it.",
      successLabel: "Last delivery received",
    }),
  );

  // 4 — Stripe webhook.
  items.push(
    webhookItem({
      key: "stripe",
      label: "Stripe webhook",
      configured: s.stripeConfigured,
      recentFailed: s.recentFailedStripe,
      lastSuccessAt: s.stripeLastSuccessAt,
      now: s.now,
      notConnectedFix:
        "Add the Stripe webhook and paste its signing secret to attribute revenue.",
      waitingDetail: "Connected — waiting for the first payment event.",
      waitingFix: "Complete a test checkout tagged with lw_ref to verify it.",
      successLabel: "Last event received",
    }),
  );

  // 5 — Recent failed deliveries: the aggregate that flags active data loss risk.
  const recentFailed = s.recentFailedGithub + s.recentFailedStripe;
  if (recentFailed > 0) {
    items.push({
      key: "deliveries",
      label: "Webhook deliveries",
      level: "red",
      status: "Action needed",
      detail: `${recentFailed} webhook deliver${
        recentFailed === 1 ? "y" : "ies"
      } failed in the last 24h.`,
      fix: "They retry automatically with backoff, so no data is lost yet — investigate if the count keeps climbing.",
    });
  } else {
    items.push({
      key: "deliveries",
      label: "Webhook deliveries",
      level: "green",
      status: "Healthy",
      detail: "No failed webhook deliveries in the last 24h.",
    });
  }

  const overall = items.reduce<HealthLevel>(
    (worst, it) => (RANK[it.level] > RANK[worst] ? it.level : worst),
    "green",
  );

  return {
    overall,
    items,
    pixelInstalled: s.signups > 0,
    lastClickAt: s.lastClickAt,
    lastSignupAt: s.lastSignupAt,
    githubLastSuccessAt: s.githubLastSuccessAt,
    stripeLastSuccessAt: s.stripeLastSuccessAt,
    recentFailedDeliveries: recentFailed,
    hasRedWebhookFailures: recentFailed > 0,
  };
}

function webhookItem(opts: {
  key: HealthItemKey;
  label: string;
  configured: boolean;
  recentFailed: number;
  lastSuccessAt: Date | null;
  now: Date;
  notConnectedFix: string;
  waitingDetail: string;
  waitingFix: string;
  successLabel: string;
}): HealthItem {
  const base = { key: opts.key, label: opts.label };
  if (!opts.configured) {
    return {
      ...base,
      level: "amber",
      status: "Not connected",
      detail: "Not connected for this product.",
      fix: opts.notConnectedFix,
    };
  }
  if (opts.recentFailed > 0) {
    return {
      ...base,
      level: "red",
      status: "Failing",
      detail: `${opts.recentFailed} deliver${
        opts.recentFailed === 1 ? "y" : "ies"
      } failed in the last 24h.`,
      fix: "Deliveries are retrying automatically — re-check the signing secret if failures persist.",
    };
  }
  if (opts.lastSuccessAt) {
    return {
      ...base,
      level: "green",
      status: "Healthy",
      detail: `${opts.successLabel} ${relTime(opts.lastSuccessAt, opts.now)}.`,
    };
  }
  return {
    ...base,
    level: "amber",
    status: "Waiting",
    detail: opts.waitingDetail,
    fix: opts.waitingFix,
  };
}

/**
 * Gather live tracking-health signals for a project and derive its status.
 * Combines attribution events with the WebhookDelivery ingestion log.
 */
export async function getTrackingHealth(
  projectId: string,
  now: Date = new Date(),
): Promise<TrackingHealth> {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { githubRepo: true, webhookSecret: true, stripeWebhookSecret: true },
  });

  const githubConfigured =
    Boolean(project?.githubRepo) &&
    (Boolean(project?.webhookSecret) || Boolean(env.GITHUB_WEBHOOK_SECRET));
  const stripeConfigured = Boolean(project?.stripeWebhookSecret);

  const eventWhere = { trackedLink: { post: { ship: { projectId } } } } as const;
  const since = new Date(now.getTime() - FAILED_DELIVERY_WINDOW_MS);

  const [
    signups,
    clicks,
    lastSignup,
    lastClick,
    githubSuccess,
    stripeSuccess,
    recentFailedGithub,
    recentFailedStripe,
  ] = await Promise.all([
    db.event.count({ where: { ...eventWhere, type: "SIGNUP" } }),
    db.event.count({ where: { ...eventWhere, type: "CLICK" } }),
    db.event.findFirst({
      where: { ...eventWhere, type: "SIGNUP" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    db.event.findFirst({
      where: { ...eventWhere, type: "CLICK" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    db.webhookDelivery.findFirst({
      where: { projectId, source: "GITHUB", status: "PROCESSED" },
      orderBy: { processedAt: "desc" },
      select: { processedAt: true },
    }),
    db.webhookDelivery.findFirst({
      where: { projectId, source: "STRIPE", status: "PROCESSED" },
      orderBy: { processedAt: "desc" },
      select: { processedAt: true },
    }),
    db.webhookDelivery.count({
      where: { projectId, source: "GITHUB", status: "FAILED", receivedAt: { gte: since } },
    }),
    db.webhookDelivery.count({
      where: { projectId, source: "STRIPE", status: "FAILED", receivedAt: { gte: since } },
    }),
  ]);

  return deriveTrackingHealth({
    signups,
    clicks,
    lastSignupAt: lastSignup?.createdAt ?? null,
    lastClickAt: lastClick?.createdAt ?? null,
    githubConfigured,
    githubLastSuccessAt: githubSuccess?.processedAt ?? null,
    stripeConfigured,
    stripeLastSuccessAt: stripeSuccess?.processedAt ?? null,
    recentFailedGithub,
    recentFailedStripe,
    now,
  });
}
