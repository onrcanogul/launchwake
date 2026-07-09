import { db } from "./db";
import { env } from "./env";
import { formatMoney } from "./attribution";
import { sendEmail, emailConfigured } from "./notify";
import { unsubscribeUrl, emailFooter } from "./emailPrefs";
import { getBenchmarkMap, MIN_FIRST_PARTY_POSTS } from "./benchmarks";
import { productTagFor, bucketLabel } from "./stats";

/**
 * Monthly report — a per-project "here's what last month did" email, sent on the
 * 1st. Reuses the weekly digest's plain-section rendering (CAPS headers, indented
 * lines, tabular money) and adds two things the digest doesn't: one benchmark
 * comparison line (how the best channel did vs the category median) and a
 * copy-paste SHAREABLE line for a build-in-public update.
 *
 * Pure builders/formatters are unit-tested; the runner is driven by
 * /api/cron/monthly-report (1st-of-month cron).
 */

export type MonthlyStats = {
  clicks: number;
  signups: number;
  revenueCents: number;
  currency: string;
  /** Best channel by signups last month (name), or null. */
  bestChannel: string | null;
  /** Catalog slug of the best channel, for the benchmark lookup. */
  bestChannelSlug: string | null;
  /** Signups on the best channel last month (for the benchmark comparison). */
  bestChannelSignups: number;
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "June 2026" for a month index (0-11) + year. Pure. */
export function monthLabel(monthIndex: number, year: number): string {
  return `${MONTHS[monthIndex] ?? ""} ${year}`;
}

/**
 * One benchmark comparison line for the best channel vs the category median.
 * Falls back to a "still building" note when there isn't enough category data —
 * so the report always has exactly one benchmark line, never a fabricated number.
 * Pure.
 */
export function benchmarkComparisonLine(input: {
  channelName: string | null;
  channelSignups: number;
  categoryLabel: string;
  benchmark: { medianSignups: number; sampleSize: number } | null;
}): string {
  const { channelName, benchmark, categoryLabel } = input;
  if (!channelName || !benchmark || benchmark.sampleSize < MIN_FIRST_PARTY_POSTS) {
    return `Benchmarks for ${categoryLabel} are still building — you'll see how your channels compare as more launches are tracked.`;
  }
  const median = benchmark.medianSignups;
  const you = input.channelSignups;
  const verdict =
    you >= median
      ? `you're at or above the median — keep leaning in`
      : `room to grow — a sharper hook or better timing can close the gap`;
  return `${channelName}: you got ${you} signup${you === 1 ? "" : "s"} last month; the median ${categoryLabel} launch sees ${median} from this channel. ${verdict}.`;
}

/** One suggested action for next month, grounded in last month's numbers. Pure. */
export function suggestedAction(stats: Pick<MonthlyStats, "clicks" | "signups" | "revenueCents" | "bestChannel">): string {
  if (stats.revenueCents > 0 && stats.bestChannel) {
    return `Double down on ${stats.bestChannel} — it's driving revenue, not just signups. Line up next month's ship with it as the lead channel.`;
  }
  if (stats.bestChannel) {
    return `Do more of ${stats.bestChannel} next month — it converted best. Plan your next ship around it and post a follow-up.`;
  }
  if (stats.clicks > 0 && stats.signups === 0) {
    return `Clicks came in but no signups — confirm the tracking pixel is on your signup success page, then post your next ship.`;
  }
  return `Ship something and distribute it — open your plan, pick the top channel, and post. One launch beats a quiet month.`;
}

/** The plain-text SHAREABLE line — a copy-paste build-in-public update. Pure. */
export function shareableLine(input: {
  projectName: string;
  monthLabel: string;
  stats: MonthlyStats;
}): string {
  const { stats } = input;
  const revenue =
    stats.revenueCents > 0 ? `, ${formatMoney(stats.revenueCents, stats.currency)} in attributed revenue` : "";
  const best = stats.bestChannel ? ` Best channel: ${stats.bestChannel}.` : "";
  return `${input.projectName} — ${input.monthLabel}: ${stats.signups} signup${stats.signups === 1 ? "" : "s"} from ${stats.clicks} click${stats.clicks === 1 ? "" : "s"}${revenue}.${best} Tracked with LaunchWake.`;
}

export type MonthlyReportEmail = { subject: string; text: string };

/** Build the monthly report email. Pure — mirrors the digest's section style. */
export function buildMonthlyReport(input: {
  projectName: string;
  monthLabel: string;
  appUrl: string;
  stats: MonthlyStats;
  benchmarkLine: string;
  unsubscribeUrl: string;
}): MonthlyReportEmail {
  const { stats } = input;
  const base = input.appUrl.replace(/\/$/, "");
  const revenue =
    stats.revenueCents > 0 ? ` · ${formatMoney(stats.revenueCents, stats.currency)} revenue` : "";

  const lines = [
    `Here's how ${input.projectName} did in ${input.monthLabel}.`,
    "",
    "LAST MONTH",
    `  ${stats.clicks} click${stats.clicks === 1 ? "" : "s"} · ${stats.signups} signup${stats.signups === 1 ? "" : "s"}${revenue}`,
    `  ${stats.bestChannel ? `Best channel: ${stats.bestChannel}` : "No channel signups yet"}`,
    "",
    "BENCHMARK",
    `  ${input.benchmarkLine}`,
    "",
    "NEXT MONTH",
    `  ${suggestedAction(stats)}`,
    "",
    "SHAREABLE — copy/paste for your build-in-public update",
    `  ${shareableLine({ projectName: input.projectName, monthLabel: input.monthLabel, stats })}`,
    "",
    `Open your Results → ${base}/app/results`,
    "",
    emailFooter(input.unsubscribeUrl),
  ];

  return {
    subject: `${input.projectName}: your ${input.monthLabel} distribution report`,
    text: lines.join("\n"),
  };
}

// ── Read side ──────────────────────────────────────────────

/** Per-project attribution for a month window [since, until). */
export async function getMonthlyStats(
  projectId: string,
  since: Date,
  until: Date,
): Promise<MonthlyStats> {
  const posts = await db.post.findMany({
    where: { ship: { projectId } },
    select: {
      channel: { select: { name: true, slug: true } },
      trackedLink: {
        select: {
          events: {
            select: { type: true, amountCents: true, currency: true, createdAt: true },
          },
        },
      },
    },
  });

  let clicks = 0;
  let signups = 0;
  let revenueCents = 0;
  let currency = "usd";
  const bySignup = new Map<string, { name: string; slug: string; signups: number }>();

  for (const p of posts) {
    for (const e of p.trackedLink?.events ?? []) {
      if (e.createdAt < since || e.createdAt >= until) continue;
      if (e.type === "CLICK") clicks += 1;
      else if (e.type === "SIGNUP") {
        signups += 1;
        const cur =
          bySignup.get(p.channel.slug) ?? { name: p.channel.name, slug: p.channel.slug, signups: 0 };
        cur.signups += 1;
        bySignup.set(p.channel.slug, cur);
      } else if (e.type === "REVENUE") {
        revenueCents += e.amountCents ?? 0;
        if (e.currency) currency = e.currency;
      }
    }
  }

  const best = [...bySignup.values()].sort((a, b) => b.signups - a.signups || a.name.localeCompare(b.name))[0] ?? null;

  return {
    clicks,
    signups,
    revenueCents,
    currency,
    bestChannel: best?.name ?? null,
    bestChannelSlug: best?.slug ?? null,
    bestChannelSignups: best?.signups ?? 0,
  };
}

export type MonthlyReportSummary = {
  processed: number;
  sent: number;
  skipped: number;
  failed: number;
  note?: string;
};

/**
 * Send the monthly report for the just-ended month, one email per project whose
 * owner is opted in and that has actually distributed something (≥1 post). Guarded
 * per (project, month) via the LifecycleEmail ledger so a double fire on the 1st
 * won't re-send. Never throws to the caller. Driven by /api/cron/monthly-report.
 */
export async function runMonthlyReports(now: Date = new Date()): Promise<MonthlyReportSummary> {
  if (!emailConfigured()) {
    return { processed: 0, sent: 0, skipped: 0, failed: 0, note: "email not configured" };
  }

  // The month that just ended: [first-of-previous, first-of-current).
  const until = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const mLabel = monthLabel(since.getUTCMonth(), since.getUTCFullYear());
  const monthStamp = `${since.getUTCFullYear()}-${String(since.getUTCMonth() + 1).padStart(2, "0")}`;

  // Candidate projects: opted-in owner, at least one post (they've distributed).
  const projects = await db.project.findMany({
    where: {
      user: { emailNotifications: true },
      ships: { some: { posts: { some: {} } } },
    },
    select: {
      id: true,
      name: true,
      description: true,
      url: true,
      user: { select: { id: true, email: true } },
    },
  });

  // One query to find which (project, month) reports already went out.
  const keys = projects.map((p) => `${p.id}:${monthStamp}`);
  const done = new Set(
    (
      await db.lifecycleEmail.findMany({
        where: { kind: "MONTHLY_REPORT", key: { in: keys } },
        select: { key: true },
      })
    ).map((r) => r.key),
  );

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const project of projects) {
    const key = `${project.id}:${monthStamp}`;
    if (done.has(key)) {
      skipped += 1;
      continue;
    }
    try {
      const stats = await getMonthlyStats(project.id, since, until);

      // Benchmark line for the best channel in the project's category.
      const productTag = productTagFor(
        `${project.name} ${project.description ?? ""} ${project.url ?? ""}`,
      );
      const categoryLabel = bucketLabel(productTag);
      let benchmark: { medianSignups: number; sampleSize: number } | null = null;
      if (stats.bestChannelSlug) {
        const map = await getBenchmarkMap(productTag).catch(() => new Map());
        const view = map.get(stats.bestChannelSlug);
        if (view) benchmark = { medianSignups: view.medianSignups, sampleSize: view.sampleSize };
      }
      const benchmarkLine = benchmarkComparisonLine({
        channelName: stats.bestChannel,
        channelSignups: stats.bestChannelSignups,
        categoryLabel,
        benchmark,
      });

      const unsub = unsubscribeUrl(env.APP_URL, project.user.id);
      const email = buildMonthlyReport({
        projectName: project.name,
        monthLabel: mLabel,
        appUrl: env.APP_URL,
        stats,
        benchmarkLine,
        unsubscribeUrl: unsub,
      });
      const res = await sendEmail(project.user.email, email.subject, email.text, {
        unsubscribeUrl: unsub,
      });
      if (!res.ok) {
        failed += 1;
        continue;
      }

      await db.lifecycleEmail.createMany({
        data: [{ userId: project.user.id, kind: "MONTHLY_REPORT", key, sentAt: now }],
        skipDuplicates: true,
      });
      sent += 1;
    } catch {
      failed += 1;
    }
  }

  return { processed: projects.length, sent, skipped, failed };
}
