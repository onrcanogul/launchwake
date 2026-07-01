import { db } from "./db";
import type { ShipType, ShipStatus } from "@prisma/client";

export type ShipRow = {
  id: string;
  type: ShipType;
  title: string;
  status: ShipStatus;
  detectedAt: Date;
  hasPlan: boolean;
  recCount: number;
  postCount: number;
  signupCount: number;
  /** came in via the GitHub webhook (commit/release) */
  autoDetected: boolean;
};

export type FeedStats = {
  shipsTotal: number;
  shipsDistributed: number;
  shipsNeedingPlan: number;
  clicks: number;
  signups: number;
  bestChannel: string | null;
};

export type ShipFeed = {
  ships: ShipRow[];
  stats: FeedStats;
};

/** Full ship feed for a project: rows + rolled-up month stats. */
export async function getShipFeed(projectId: string): Promise<ShipFeed> {
  const ships = await db.ship.findMany({
    where: { projectId },
    orderBy: { detectedAt: "desc" },
    include: {
      plan: { select: { _count: { select: { recs: true } } } },
      posts: {
        select: {
          id: true,
          channel: { select: { name: true } },
          trackedLink: {
            select: { events: { select: { type: true } } },
          },
        },
      },
    },
  });

  // Aggregate signups per channel for the "best channel" stat.
  const signupsByChannel = new Map<string, number>();
  let totalClicks = 0;

  const rows: ShipRow[] = ships.map((s) => {
    let signupCount = 0;
    for (const p of s.posts) {
      const events = p.trackedLink?.events ?? [];
      const clicks = events.filter((e) => e.type === "CLICK").length;
      const signups = events.filter((e) => e.type === "SIGNUP").length;
      totalClicks += clicks;
      signupCount += signups;
      if (signups > 0) {
        signupsByChannel.set(
          p.channel.name,
          (signupsByChannel.get(p.channel.name) ?? 0) + signups,
        );
      }
    }
    return {
      id: s.id,
      type: s.type,
      title: s.title,
      status: s.status,
      detectedAt: s.detectedAt,
      hasPlan: Boolean(s.plan),
      recCount: s.plan?._count.recs ?? 0,
      postCount: s.posts.length,
      signupCount,
      autoDetected:
        Boolean(s.commitSha) || Boolean(s.sourceUrl?.includes("github.com")),
    };
  });

  const bestChannel =
    [...signupsByChannel.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const stats: FeedStats = {
    shipsTotal: rows.length,
    shipsDistributed: rows.filter((r) => r.postCount > 0 || r.hasPlan).length,
    shipsNeedingPlan: rows.filter((r) => !r.hasPlan).length,
    clicks: totalClicks,
    signups: rows.reduce((n, r) => n + r.signupCount, 0),
    bestChannel,
  };

  return { ships: rows, stats };
}

export type ShipListItem = {
  id: string;
  title: string;
  type: ShipType;
  status: ShipStatus;
};

/** Lightweight list of a project's ships for the in-header ship switcher. */
export async function listProjectShips(
  projectId: string,
): Promise<ShipListItem[]> {
  return db.ship.findMany({
    where: { projectId },
    orderBy: { detectedAt: "desc" },
    select: { id: true, title: true, type: true, status: true },
  });
}

const TYPE_META: Record<ShipType, { label: string }> = {
  LAUNCH: { label: "Launch" },
  FEATURE: { label: "Feature" },
  BLOG: { label: "Blog" },
  OTHER: { label: "Other" },
};

export function shipTypeLabel(type: ShipType): string {
  return TYPE_META[type].label;
}

/** Human "6h ago" / "2 days ago" for ship meta lines. */
export function relativeTime(date: Date, now: Date = new Date()): string {
  const secs = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));
  const mins = Math.floor(secs / 60);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (days >= 1) return days === 1 ? "1 day ago" : `${days} days ago`;
  if (hours >= 1) return `${hours}h ago`;
  if (mins >= 1) return `${mins}m ago`;
  return "just now";
}
