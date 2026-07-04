import { buildPlan } from "./analysis";
import { db } from "./db";
import { env } from "./env";
import { reminderMessage } from "./reminders";
import { sendEmail, sendSlack, emailConfigured } from "./notify";
import { captureError } from "./observability";
import { getPlanUsage, entitlementViolation } from "./billing";
import {
  buildPlanReadyEmail,
  buildPlanLimitEmail,
  planUrl,
  settingsUrl,
} from "./shipNotify";
import {
  withRetry,
  recordWebhookFailure,
  retryDelayMs,
  MAX_WEBHOOK_ATTEMPTS,
} from "./webhookDelivery";
import {
  findIntentMatches,
  ingestMatches,
  generateIntentReply,
  buildIntentAlert,
} from "./intentRadar";

/**
 * Background-job seam. For the MVP these run inline / on a cron ping; the
 * boundary is here so they can be moved behind Inngest without touching callers.
 * Keep job functions idempotent.
 */
export async function runAnalysisJob(shipId: string): Promise<void> {
  await buildPlan(shipId);
}

/**
 * Email the founder that an auto-detected ship's plan is ready. Best-effort;
 * self-loads so both the immediate webhook path and the retry cron can call it.
 */
export async function notifyPlanReady(shipId: string): Promise<void> {
  if (!emailConfigured()) return;
  const ship = await db.ship.findUnique({
    where: { id: shipId },
    select: {
      title: true,
      project: { select: { name: true, user: { select: { email: true } } } },
    },
  });
  if (!ship) return;
  const mail = buildPlanReadyEmail({
    shipTitle: ship.title,
    projectName: ship.project.name,
    url: planUrl(env.APP_URL, shipId),
  });
  await sendEmail(ship.project.user.email, mail.subject, mail.text).catch(() => {});
}

/**
 * Auto-generate the distribution plan for an auto-detected ship, then email the
 * founder it's ready — the post-launch growth loop, minus the "paste a new
 * changelog" nudge. Respects the Free-tier monthly plan limit (lib/billing): at
 * the limit we skip the build and send an upgrade nudge instead (the ship still
 * lands in the feed). Retries transient failures; on final failure persists a
 * retryable WebhookDelivery for the cron. Called from the webhook's after(), so
 * it must never throw.
 */
export async function runGithubAnalysisResilient(
  shipId: string,
  ctx: { projectId: string; eventType: string | null },
): Promise<void> {
  const ship = await db.ship.findUnique({
    where: { id: shipId },
    select: {
      title: true,
      project: {
        select: { name: true, userId: true, user: { select: { email: true } } },
      },
    },
  });
  if (!ship) return;

  // Free-tier gate: respect the monthly plan quota for auto-plans, same as the
  // manual "create ship" path. At the limit, nudge instead of burning a plan.
  const usage = await getPlanUsage(ship.project.userId);
  const violation = entitlementViolation(usage, "create_plan");
  if (violation) {
    if (emailConfigured() && usage.planLimit !== null) {
      const mail = buildPlanLimitEmail({
        shipTitle: ship.title,
        projectName: ship.project.name,
        used: usage.plansThisMonth,
        limit: usage.planLimit,
        upgradeUrl: settingsUrl(env.APP_URL),
      });
      await sendEmail(ship.project.user.email, mail.subject, mail.text).catch(() => {});
    }
    return;
  }

  try {
    await withRetry(() => runAnalysisJob(shipId), { attempts: 3 });
  } catch (err) {
    captureError(err, { at: "github.webhook.analysis", shipId });
    await recordWebhookFailure({
      source: "GITHUB",
      projectId: ctx.projectId,
      eventType: ctx.eventType,
      shipId,
      attempts: 1,
      error: (err as Error)?.message ?? String(err),
      retryable: true,
    });
    return;
  }

  await notifyPlanReady(shipId);
}

export type WebhookRetrySummary = {
  processed: number;
  recovered: number;
  failed: number;
};

/**
 * Re-drive due, retryable GitHub webhook failures (analysis that kept failing
 * after the initial in-process retries). Called by /api/cron/webhooks. Backs off
 * per attempt and dead-letters after MAX_WEBHOOK_ATTEMPTS. Idempotent: buildPlan
 * replaces any existing plan for the ship.
 */
export async function retryDueWebhookDeliveries(
  now: Date = new Date(),
  limit = 20,
): Promise<WebhookRetrySummary> {
  const due = await db.webhookDelivery.findMany({
    where: {
      source: "GITHUB",
      status: "FAILED",
      shipId: { not: null },
      nextRetryAt: { not: null, lte: now },
    },
    orderBy: { nextRetryAt: "asc" },
    take: limit,
  });

  let recovered = 0;
  let failed = 0;
  for (const d of due) {
    try {
      await runAnalysisJob(d.shipId!);
      await db.webhookDelivery.update({
        where: { id: d.id },
        data: { status: "SUCCESS", succeededAt: now, nextRetryAt: null, error: null },
      });
      // The plan finally built — close the loop with the "plan is ready" email.
      await notifyPlanReady(d.shipId!);
      recovered += 1;
    } catch (err) {
      const attempts = d.attempts + 1;
      await db.webhookDelivery.update({
        where: { id: d.id },
        data: {
          attempts,
          error: ((err as Error)?.message ?? String(err)).slice(0, 500),
          nextRetryAt:
            attempts < MAX_WEBHOOK_ATTEMPTS
              ? new Date(now.getTime() + retryDelayMs(attempts))
              : null,
        },
      });
      failed += 1;
    }
  }
  return { processed: due.length, recovered, failed };
}

export type ReminderRunSummary = {
  processed: number;
  sent: number;
  failed: number;
};

/**
 * Deliver every reminder that's due. Called by /api/cron/reminders on a schedule.
 * Marks each SENT or FAILED so it never double-sends.
 */
export async function processDueReminders(
  now: Date = new Date(),
): Promise<ReminderRunSummary> {
  const due = await db.reminder.findMany({
    where: { status: "PENDING", sendAt: { lte: now } },
    orderBy: { sendAt: "asc" },
    take: 50,
    include: {
      user: { select: { email: true } },
      // Slack webhook lives on the ship's project.
    },
  });

  let sent = 0;
  let failed = 0;

  for (const r of due) {
    const { subject, text } = reminderMessage(
      {
        shipId: r.shipId,
        channelName: r.channelName,
        shipTitle: r.shipTitle,
        bestTimeLabel: r.bestTimeLabel,
        ruleNote: r.ruleNote,
      },
      env.APP_URL,
    );

    let result: { ok: boolean; error?: string };
    if (r.method === "EMAIL") {
      result = await sendEmail(r.user.email, subject, text);
    } else {
      const ship = await db.ship.findUnique({
        where: { id: r.shipId },
        select: { project: { select: { slackWebhookUrl: true } } },
      });
      result = await sendSlack(ship?.project.slackWebhookUrl, `*${subject}*\n${text}`);
    }

    await db.reminder.update({
      where: { id: r.id },
      data: result.ok
        ? { status: "SENT", sentAt: new Date(), error: null }
        : { status: "FAILED", error: result.error },
    });
    if (result.ok) sent++;
    else failed++;
  }

  return { processed: due.length, sent, failed };
}

export type IntentRadarRunSummary = {
  queries: number;
  matched: number;
  drafted: number;
  notified: number;
};

// How many fresh matches per query per run get an LLM draft (cost guard). The
// rest still surface in the feed; drafts fill in on demand from the UI.
const DRAFTS_PER_QUERY_RUN = 3;

/**
 * Intent Radar sweep. For each active query: find + ingest fresh matches,
 * pre-draft the top few ban-safe replies, then alert the owner (email + Slack).
 * Called by /api/cron/intent-radar. Idempotent — ingest dedupes, and matches
 * are marked NOTIFIED so a re-run won't re-alert. Never throws to the caller.
 */
export async function processIntentRadar(
  now: Date = new Date(),
): Promise<IntentRadarRunSummary> {
  const queries = await db.intentQuery.findMany({
    where: { active: true },
    include: {
      project: {
        select: {
          name: true,
          slackWebhookUrl: true,
          user: { select: { email: true } },
        },
      },
    },
  });

  let matched = 0;
  let drafted = 0;
  let notified = 0;

  for (const q of queries) {
    const scored = await findIntentMatches(q, now).catch(() => []);
    const created = await ingestMatches(q.id, scored).catch(() => []);
    if (created.length === 0) continue;
    matched += created.length;

    // Pre-draft the strongest matches; budget/no-key failures are non-fatal.
    const top = [...created].sort((a, b) => b.score - a.score).slice(0, DRAFTS_PER_QUERY_RUN);
    for (const m of top) {
      try {
        await generateIntentReply(m.id);
        drafted += 1;
      } catch {
        // Over budget or LLM error — leave draftBody null; UI can retry.
      }
    }

    // Alert the owner. Best-effort on each transport.
    const alert = buildIntentAlert(q.title, created.length, env.APP_URL);
    if (emailConfigured()) {
      await sendEmail(q.project.user.email, alert.subject, alert.text).catch(() => {});
    }
    if (q.project.slackWebhookUrl) {
      await sendSlack(q.project.slackWebhookUrl, `*${alert.subject}*\n${alert.text}`).catch(
        () => {},
      );
    }

    await db.intentMatch.updateMany({
      where: { id: { in: created.map((c) => c.id) } },
      data: { status: "NOTIFIED", notifiedAt: now },
    });
    notified += created.length;
  }

  return { queries: queries.length, matched, drafted, notified };
}
