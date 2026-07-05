import { buildPlan } from "./analysis";
import { db } from "./db";
import { env } from "./env";
import { reminderMessage } from "./reminders";
import { sendEmail, sendSlack, emailConfigured } from "./notify";
import { assertEntitlement, EntitlementError } from "./billing";
import { unsubscribeUrl } from "./emailPrefs";
import { buildPlanReadyEmail, buildPlanLimitEmail } from "./shipEmail";
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
/**
 * The release → return loop. After a GitHub webhook creates a Ship: build its
 * DistributionPlan (respecting the Free 2-plans/month gate — the webhook path
 * gets no free pass) and email "your distribution plan is ready" so the founder
 * comes back to distribute what they shipped. At the limit, the ship is kept
 * and the email says so instead — detected-but-silent releases churn people.
 * Email is best-effort and gated by the user's email preference.
 */
export async function runWebhookShipJob(shipId: string): Promise<void> {
  const ship = await db.ship.findUnique({
    where: { id: shipId },
    include: {
      project: {
        select: {
          name: true,
          userId: true,
          user: { select: { id: true, email: true, emailNotifications: true } },
        },
      },
    },
  });
  if (!ship) return;
  const owner = ship.project.user;

  let limited = false;
  try {
    await assertEntitlement(ship.project.userId, "create_plan");
  } catch (err) {
    if (err instanceof EntitlementError) limited = true;
    else throw err;
  }

  if (!limited) await buildPlan(shipId);

  if (!emailConfigured() || !owner.emailNotifications) return;

  const unsub = unsubscribeUrl(env.APP_URL, owner.id);
  let email;
  if (limited) {
    email = buildPlanLimitEmail({
      projectName: ship.project.name,
      shipTitle: ship.title,
      appUrl: env.APP_URL,
      unsubscribeUrl: unsub,
    });
  } else {
    const recs = await db.recommendation.findMany({
      where: { plan: { shipId } },
      orderBy: [{ rank: "asc" }, { fitScore: "desc" }],
      take: 3,
      include: { channel: { select: { name: true } } },
    });
    email = buildPlanReadyEmail({
      projectName: ship.project.name,
      shipTitle: ship.title,
      shipId,
      appUrl: env.APP_URL,
      channels: recs.map((r) => ({
        name: r.channel.name,
        fitScore: r.fitScore,
        banRisk: r.banRisk,
      })),
      unsubscribeUrl: unsub,
    });
  }
  // Best-effort: sendEmail reports failure in its result instead of throwing,
  // so a mail hiccup can't fail the (already processed) delivery.
  await sendEmail(owner.email, email.subject, email.text, { unsubscribeUrl: unsub });
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
