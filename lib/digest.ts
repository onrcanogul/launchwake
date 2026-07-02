import { db } from "./db";
import { env } from "./env";
import { formatMoney } from "./attribution";
import { getLaunchRadar, buildRadarDigest } from "./radar";
import { sendEmail, emailConfigured } from "./notify";

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
  /** Ships with a plan but nothing posted yet. */
  undistributed: { title: string; channels: number }[];
};

/** Compute last-week attribution + "needs action" state for one account. */
export async function getWeeklyStats(accountId: string, since: Date): Promise<WeeklyStats> {
  const [posts, shipsLastWeek, postsLastWeek, undistributedShips] = await Promise.all([
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
  };
}

/** "What to do this week" — grounded in the account's own state. Pure. */
export function weeklyRecommendations(stats: WeeklyStats): string[] {
  const recs: string[] = [];

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
}): DigestEmail {
  const { stats } = input;
  const base = input.appUrl.replace(/\/$/, "");
  const revenue =
    stats.revenueCents > 0 ? ` · ${formatMoney(stats.revenueCents, stats.currency)} revenue` : "";

  const subject = `Your distribution week — ${stats.signups} signup${stats.signups === 1 ? "" : "s"} from ${stats.clicks} click${stats.clicks === 1 ? "" : "s"}`;

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

  if (input.radar) {
    lines.push("", "LAUNCH RADAR — in your category", input.radar.text);
  }

  lines.push(
    "",
    `Open LaunchWake → ${base}/app`,
    "",
    "— LaunchWake · you post it, we tell you where. Manage emails in Settings.",
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
  // excluded because they don't own one).
  const owners = await db.user.findMany({
    where: {
      projects: { some: {} },
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
      const email = buildDigest({ projectName: project.name, appUrl: env.APP_URL, stats, radar });
      const res = await sendEmail(owner.email, email.subject, email.text);
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
