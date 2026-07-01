import { db } from "./db";

/**
 * Attribution read side. The write side (tracked-link creation + click/signup
 * ingest) lands in Milestone 2; this rollup already reads whatever events exist
 * so the Results screen lights up automatically once posting is wired.
 */

export type ResultRow = {
  channelName: string;
  shipTitle: string;
  clicks: number;
  signups: number;
  conversion: number; // 0..1
  removed: boolean;
};

export type ResultsRollup = {
  rows: ResultRow[];
  totalSignups: number;
};

export async function getResultsRollup(
  projectId: string,
): Promise<ResultsRollup> {
  const posts = await db.post.findMany({
    where: { ship: { projectId } },
    include: {
      channel: { select: { name: true } },
      ship: { select: { title: true } },
      trackedLink: { include: { events: { select: { type: true } } } },
    },
    orderBy: { postedAt: "desc" },
  });

  const rows: ResultRow[] = posts.map((p) => {
    const events = p.trackedLink?.events ?? [];
    const clicks = events.filter((e) => e.type === "CLICK").length;
    const signups = events.filter((e) => e.type === "SIGNUP").length;
    return {
      channelName: p.channel.name,
      shipTitle: p.ship.title,
      clicks,
      signups,
      conversion: clicks > 0 ? signups / clicks : 0,
      removed: p.status === "REMOVED",
    };
  });

  return {
    rows,
    totalSignups: rows.reduce((n, r) => n + r.signups, 0),
  };
}
