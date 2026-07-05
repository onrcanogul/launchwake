import { db } from "./db";
import { env } from "./env";
import { formatMoney } from "./attribution";
import { getLaunchRadar, buildRadarDigest } from "./radar";
import { sendEmail, emailConfigured } from "./notify";
import { unsubscribeUrl, emailFooter } from "./emailPrefs";
import { tasksDueThisWeek, type DueTask } from "./queue";
import { pitchesToFollowUp, type FollowUpPitch } from "./pitch";

/**
 * Weekly Monday digest — the anti-churn nudge. Last week's clicks/signups, then
 * "what to do this week": distribute a shipped-but-unposted release, follow up on
 * a channel that leaked traffic, or (on a quiet week) refresh your best post.
 * Silence is how SaaS churns; this brings founders back. Pure builders are
 * unit-tested; the runner is driven by /api/cron/digest.
 */

export type WeeklyStats = {
  clicks: number;
  signups: number;
  revenueCents: number;
  currency: string;
  topChannel: string | null;
  shipsLastWeek: number;
  postsLastWeek: number;
  /** Channels with traffic but no signups (most leaky first). */
  leaky: { channel: string; clicks: number }[];
  /** Ships with a plan but nothing posted yet (top few, for the body). */
  undistributed: { title: string; channels: number }[];
  /** Total count of shipped-but-unannounced ships (drives the subject line). */
  undistributedCount: number;
  /** New Intent Radar matches this week (people asking for a tool like yours). */
  intentMatches?: number;
  /** Distribution-queue tasks coming due this week. */
  queuedTasks?: DueTask[];
  /** Newsletter pitches sent but not replied to, past their follow-up window. */
  followUpPitches?: FollowUpPitch[];
};

/** Compute last-week attribution + "needs action" state for one account. */
export async function getWeeklyStats(accountId: string, since: Date): Promise<WeeklyStats> {
  const [
    posts,
    shipsLastWeek,
    postsLastWeek,
    undistributedShips,
    undistributedCount,
    intentMatches,
    queuedTasks,
    followUpPitches,
  ] = await Promise.all([
    db.post.findMany({
      where: { ship: { project: { userId: accountId } } },
      include: {
        channel: { select: { name: true } },
        trackedLink: {
          include: { events: { select: { type: true, amountCents: true, currency: true, createdAt: true } } },
        },
      },
    }),
    db.ship.count({ where: { project: { userId: accountId }, detectedAt: { gte: since } } }),
    db.post.count({ where: { ship: { project: { userId: accountId } }, postedAt: { gte: since } } }),
    db.ship.findMany({
      where: { project: { userId: accountId }, plan: { isNot: null }, posts: { none: {} } },
      include: { plan: { include: { recs: { select: { id: true } } } } },
      orderBy: { detectedAt: "desc" },
      take: 3,
    }),
    db.ship.count({
      where: { project: { userId: accountId }, plan: { isNot: null }, posts: { none: {} } },
    }),
    db.intentMatch.count({
      where: {
        query: { project: { userId: accountId } },
        createdAt: { gte: since },
        status: { not: "DISMISSED" },
      },
    }),
    tasksDueThisWeek(accountId),
    pitchesToFollowUp(accountId),
  ]);

  let clicks = 0;
  let signups = 0;
  let revenueCents = 0;
  let currency = "usd";
  const bySignup = new Map<string, number>();
  const leaky: { channel: string; clicks: number }[] = [];

  for (const p of posts) {
    const events = p.trackedLink?.events ?? [];
    let allClicks = 0;
    let allSignups = 0;
    for (const e of events) {
      // All-time tallies drive the "leaky channel" signal.
      if (e.type === "CLICK") allClicks += 1;
      else if (e.type === "SIGNUP") allSignups += 1;
      // Last-week window drives the headline numbers.
      if (e.createdAt < since) continue;
      if (e.type === "CLICK") clicks += 1;
      else if (e.type === "SIGNUP") {
        signups += 1;
        bySignup.set(p.channel.name, (bySignup.get(p.channel.name) ?? 0) + 1);
      } else if (e.type === "REVENUE") {
        revenueCents += e.amountCents ?? 0;
        if (e.currency) currency = e.currency;
      }
    }
    if (allClicks >= 8 && allSignups === 0) leaky.push({ channel: p.channel.name, clicks: allClicks });
  }

  const topChannel = [...bySignup.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  leaky.sort((a, b) => b.clicks - a.clicks);

  return {
    clicks,
    signups,
    revenueCents,
    currency,
    topChannel,
    shipsLastWeek,
    postsLastWeek,
    leaky: leaky.slice(0, 3),
    undistributed: undistributedShips.map((s) => ({
      title: s.title,
      channels: s.plan?.recs.length ?? 0,
    })),
    undistributedCount,
    intentMatches,
    queuedTasks,
    followUpPitches,
  };
}

/** "What to do this week" — grounded in the account's own state. Pure. */
export function weeklyRecommendations(stats: WeeklyStats): string[] {
  const recs: string[] = [];

  const queued = stats.queuedTasks ?? [];
  if (queued.length > 0) {
    const t = queued[0];
    const more = queued.length - 1;
    recs.push(
      `This week's queue: ${t.phaseLabel.toLowerCase()} — start with ${t.channelName}${more > 0 ? ` (+${more} more task${more === 1 ? "" : "s"} due)` : ""}.`,
    );
  }

  const followUps = stats.followUpPitches ?? [];
  if (followUps.length > 0) {
    const f = followUps[0];
    recs.push(
      `Follow up on your ${f.channelName} pitch — sent with no reply yet. A short, polite nudge is how most newsletter features actually happen.`,
    );
  }

  const intent = stats.intentMatches ?? 0;
  if (intent > 0) {
    recs.push(
      `${intent} ${intent === 1 ? "person" : "people"} asked for a tool like yours on HN/Reddit this week. Open Intent Radar and reply while it's warm — each one is a hot lead.`,
    );
  }

  if (stats.undistributed.length > 0) {
    const s = stats.undistributed[0];
    recs.push(
      `Distribute "${s.title}" — you have ${s.channels} channel${s.channels === 1 ? "" : "s"} queued but haven't posted yet. Start with the top pick.`,
    );
  }

  if (stats.leaky.length > 0) {
    const l = stats.leaky[0];
    recs.push(
      `${l.channel} drove ${l.clicks} clicks but no signups. Post a follow-up with a sharper hook, or make sure your signup page matches the promise.`,
    );
  }

  if (stats.postsLastWeek === 0 && stats.shipsLastWeek === 0) {
    const where = stats.topChannel ? `on ${stats.topChannel}` : "on your best channel";
    recs.push(
      `Quiet week? Silence is how momentum dies. Post a follow-up ${where}, or refresh your best post with a new angle.`,
    );
  }

  if (recs.length === 0) {
    recs.push(
      stats.signups > 0
        ? `Do more of what worked${stats.topChannel ? ` — ${stats.topChannel} is converting` : ""}. Line up your next ship.`
        : `Add the tracking pixel so next week's numbers are real, then post your next ship.`,
    );
  }

  return recs.slice(0, 3);
}

export type DigestEmail = { subject: string; text: string };

/** Build the weekly digest email. Pure. */
export function buildDigest(input: {
  projectName: string;
  appUrl: string;
  stats: WeeklyStats;
  radar?: { subject: string; text: string } | null;
  /** One-click unsubscribe link for the footer (falls back to a Settings hint). */
  unsubscribeUrl?: string;
}): DigestEmail {
  const { stats } = input;
  const base = input.appUrl.replace(/\/$/, "");
  const revenue =
    stats.revenueCents > 0 ? ` · ${formatMoney(stats.revenueCents, stats.currency)} revenue` : "";

  // Lead with the gap when there are shipped-but-unannounced ships — that's the
  // action that brings founders back; the signup recap is the fallback.
  const subject =
    stats.undistributedCount > 0
      ? `${stats.undistributedCount} ship${stats.undistributedCount === 1 ? "" : "s"} shipped, 0 announced — here's where to take them`
      : `Your distribution week — ${stats.signups} signup${stats.signups === 1 ? "" : "s"} from ${stats.clicks} click${stats.clicks === 1 ? "" : "s"}`;

  const recs = weeklyRecommendations(stats);
  const recLines = recs.map((r, i) => `${i + 1}. ${r}`);

  const lines = [
    `Here's your week in distribution for ${input.projectName}.`,
    "",
    "LAST WEEK",
    `  ${stats.clicks} clicks · ${stats.signups} signups${revenue}`,
    `  ${stats.shipsLastWeek} new ship${stats.shipsLastWeek === 1 ? "" : "s"} · ${stats.postsLastWeek} post${stats.postsLastWeek === 1 ? "" : "s"}${stats.topChannel ? ` · best: ${stats.topChannel}` : ""}`,
    "",
    "WHAT TO DO THIS WEEK",
    ...recLines,
  ];

  const queued = stats.queuedTasks ?? [];
  if (queued.length > 0) {
    lines.push("", "THIS WEEK'S QUEUE — keep the launch alive");
    for (const t of queued) {
      lines.push(`  • ${t.phaseLabel}: ${t.channelName}${t.url ? ` — ${t.url}` : ""}`);
    }
    lines.push(`  See the full cadence → ${base}/app/queue`);
  }

  const followUps = stats.followUpPitches ?? [];
  if (followUps.length > 0) {
    lines.push("", "NEWSLETTER PITCHES — time to follow up");
    for (const f of followUps) {
      lines.push(`  • ${f.channelName} (for "${f.shipTitle}") — no reply yet, send a nudge`);
    }
    lines.push(`  Manage pitches → ${base}/app/pitches`);
  }

  const intent = stats.intentMatches ?? 0;
  if (intent > 0) {
    lines.push(
      "",
      "INTENT RADAR — people asking for your product",
      `  ${intent} new conversation${intent === 1 ? "" : "s"} on HN/Reddit this week. Launches end; conversations don't.`,
      `  Reply with a ready draft → ${base}/app/radar`,
    );
  }

  if (input.radar) {
    lines.push("", "LAUNCH RADAR — in your category", input.radar.text);
  }

  lines.push(
    "",
    `Open LaunchWake → ${base}/app`,
    "",
    input.unsubscribeUrl
      ? emailFooter(input.unsubscribeUrl)
      : "— LaunchWake · you post it, we tell you where. Manage emails in Settings.",
  );

  return { subject, text: lines.join("\n") };
}

export type DigestSummary = {
  processed: number;
  sent: number;
  skipped: number;
  failed: number;
  note?: string;
};

/**
 * Send the weekly digest to every onboarded account owner not emailed in the
 * last 6 days. Called by /api/cron/digest (schedule it for Monday mornings).
 */
export async function runWeeklyDigest(now: Date = new Date()): Promise<DigestSummary> {
  if (!emailConfigured()) {
    return { processed: 0, sent: 0, skipped: 0, failed: 0, note: "email not configured" };
  }

  const since = new Date(now.getTime() - 7 * 86_400_000);
  const guard = new Date(now.getTime() - 6 * 86_400_000);

  // Account owners = users who own a project (members share the owner's, and are
  // excluded because they don't own one). Unsubscribed users are never selected.
  const owners = await db.user.findMany({
    where: {
      projects: { some: {} },
      emailNotifications: true,
      OR: [{ lastDigestAt: null }, { lastDigestAt: { lt: guard } }],
    },
    include: { projects: { orderBy: { createdAt: "asc" }, take: 1 } },
  });

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const owner of owners) {
    const project = owner.projects[0];
    if (!project) {
      skipped += 1;
      continue;
    }
    try {
      const stats = await getWeeklyStats(owner.id, since);
      const radar = await getLaunchRadar(project)
        .then((items) => buildRadarDigest(items, project.name))
        .catch(() => null);
      const unsub = unsubscribeUrl(env.APP_URL, owner.id);
      const email = buildDigest({
        projectName: project.name,
        appUrl: env.APP_URL,
        stats,
        radar,
        unsubscribeUrl: unsub,
      });
      const res = await sendEmail(owner.email, email.subject, email.text, {
        unsubscribeUrl: unsub,
      });
      if (res.ok) {
        await db.user.update({ where: { id: owner.id }, data: { lastDigestAt: now } });
        sent += 1;
      } else {
        failed += 1;
      }
    } catch {
      failed += 1;
    }
  }

  return { processed: owners.length, sent, skipped, failed };
}
