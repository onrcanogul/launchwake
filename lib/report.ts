import { randomBytes } from "crypto";
import { db } from "./db";
import { env } from "./env";
import { getResultsRollup, formatMoney, type RoiSummary } from "./attribution";
import type { BanRisk, Platform, ShipType } from "@prisma/client";

/**
 * Public Launch Report — the viral loop. A founder flips their launch public and
 * shares /report/{token}: "here's how I launched X, and what it drove". Every
 * report carries a "Powered by LaunchWake" badge + CTA, so readers discover the
 * tool. Revenue is hidden unless the owner opts in.
 */

/** Unguessable, URL-safe report token. */
export function newReportToken(): string {
  return randomBytes(9).toString("base64url");
}

export function reportUrl(token: string): string {
  return `${env.APP_URL.replace(/\/$/, "")}/report/${token}`;
}

export type ReportChannel = {
  name: string;
  platform: Platform;
  fitScore: number;
  banRisk: BanRisk;
  bestTime: string | null;
  why: string;
  clicks: number;
  signups: number;
  revenueCents: number | null;
};

export type PublicReport = {
  project: { name: string; url: string | null };
  ship: { title: string; type: ShipType; summary: string | null; when: Date };
  channels: ReportChannel[];
  showRevenue: boolean;
  totals: {
    clicks: number;
    signups: number;
    conversion: number;
    revenueCents: number | null;
    mrrCents: number | null;
  };
  roi: RoiSummary;
  topRevenueChannel: { name: string; revenueCents: number } | null;
};

/**
 * Load a public report by token, or null if the token is unknown / the launch
 * isn't public. Merges the distribution plan (where they posted) with the
 * attribution rollup (what it drove). Revenue is stripped unless opted in.
 */
export async function getPublicReport(token: string): Promise<PublicReport | null> {
  const ship = await db.ship.findUnique({
    where: { publicToken: token },
    include: {
      project: { select: { id: true, name: true, url: true } },
      plan: {
        include: {
          recs: {
            orderBy: [{ rank: "asc" }, { fitScore: "desc" }],
            include: { channel: { select: { name: true, platform: true } } },
          },
        },
      },
    },
  });
  if (!ship || !ship.publicToken) return null;

  const showRevenue = ship.publicShowRevenue;
  const rollup = await getResultsRollup(ship.project.id, { shipId: ship.id });

  // Per-channel results, keyed by channel name.
  const byChannel = new Map(rollup.perChannel.map((c) => [c.channelName, c]));

  const channels: ReportChannel[] = (ship.plan?.recs ?? []).map((r) => {
    const res = byChannel.get(r.channel.name);
    return {
      name: r.channel.name,
      platform: r.channel.platform,
      fitScore: r.fitScore,
      banRisk: r.banRisk,
      bestTime: r.bestTime,
      why: r.whyText,
      clicks: res?.clicks ?? 0,
      signups: res?.signups ?? 0,
      revenueCents: showRevenue ? (res?.revenueCents ?? 0) : null,
    };
  });

  // Sanitize revenue out of the ROI unless the owner opted in.
  const roi: RoiSummary = showRevenue
    ? rollup.roi
    : { ...rollup.roi, revenueCents: 0, recurringCents: 0 };

  return {
    project: { name: ship.project.name, url: ship.project.url },
    ship: { title: ship.title, type: ship.type, summary: ship.summary, when: ship.detectedAt },
    channels,
    showRevenue,
    totals: {
      clicks: rollup.totalClicks,
      signups: rollup.totalSignups,
      conversion: rollup.conversion,
      revenueCents: showRevenue ? rollup.totalRevenueCents : null,
      mrrCents: showRevenue ? rollup.mrrCents : null,
    },
    roi,
    topRevenueChannel: showRevenue ? rollup.topRevenueChannel : null,
  };
}

/** Headline stats for OG cards / meta descriptions (pure). */
export function reportOgStats(report: PublicReport): { label: string; value: string }[] {
  const stats = [
    { label: "channels", value: String(report.channels.length) },
    { label: "clicks", value: report.totals.clicks.toLocaleString() },
    { label: "signups", value: report.totals.signups.toLocaleString() },
  ];
  if (report.showRevenue && (report.totals.revenueCents ?? 0) > 0) {
    stats.push({ label: "revenue", value: formatMoney(report.totals.revenueCents!, report.roi.currency) });
  }
  return stats;
}

export function reportMetaDescription(report: PublicReport): string {
  const bits = [`${report.channels.length} channels`, `${report.totals.clicks} clicks`, `${report.totals.signups} signups`];
  if (report.showRevenue && (report.totals.revenueCents ?? 0) > 0) {
    bits.push(`${formatMoney(report.totals.revenueCents!, report.roi.currency)} revenue`);
  }
  return `How ${report.project.name} launched "${report.ship.title}" — ${bits.join(" · ")}. Planned with LaunchWake.`;
}

/**
 * The "Powered by LaunchWake" badge as a standalone SVG (for <img> embeds).
 * Pure → unit-testable and cacheable. One teal accent, no gradient.
 */
export function badgeSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="186" height="32" viewBox="0 0 186 32" role="img" aria-label="Powered by LaunchWake">
  <rect x="0.5" y="0.5" width="185" height="31" rx="7" fill="#0D0F14" stroke="#3ECFB6" stroke-opacity="0.35"/>
  <path d="M12 19c2 0 2-3 4-3s2 3 4 3 2-3 4-3 2 3 4 3" fill="none" stroke="#3ECFB6" stroke-width="1.8" stroke-linecap="round"/>
  <text x="40" y="14.5" fill="#9CA3B0" font-family="Inter,-apple-system,Segoe UI,sans-serif" font-size="9" letter-spacing="0.3">POWERED BY</text>
  <text x="40" y="25" fill="#E7E9ED" font-family="Inter,-apple-system,Segoe UI,sans-serif" font-size="12.5" font-weight="600" letter-spacing="-0.2">LaunchWake</text>
</svg>`;
}
