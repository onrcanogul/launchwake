import { buildPlan } from "./analysis";
import { db } from "./db";
import { env } from "./env";
import { reminderMessage } from "./reminders";
import { sendEmail, sendSlack } from "./notify";

/**
 * Background-job seam. For the MVP these run inline / on a cron ping; the
 * boundary is here so they can be moved behind Inngest without touching callers.
 * Keep job functions idempotent.
 */
export async function runAnalysisJob(shipId: string): Promise<void> {
  await buildPlan(shipId);
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
