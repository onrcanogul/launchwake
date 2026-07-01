import { db } from "./db";
import { deriveSignalTags } from "./channels";

/**
 * The flywheel: aggregate real outcomes (posts, clicks, signups, removals) per
 * channel, bucketed by a product "profile tag" so the signal is relevant to
 * similar products. analysis.ts uses these to re-rank and to raise ban risk.
 */

export type OutcomeSignal = {
  posts: number;
  clicks: number;
  signups: number;
  removals: number;
};

// Stable, representative buckets in priority order (most specific first).
const BUCKET_PRIORITY = [
  "devtools",
  "saas",
  "webdev",
  "devops",
  "infra",
  "ai",
  "opensource",
  "selfhosted",
  "node",
  "javascript",
  "frontend",
  "backend",
  "b2b",
  "founders",
];

/** Derive a stable profile bucket like "devtools-backend" for a product. */
export function productTagFor(projectText: string): string {
  const signals = deriveSignalTags({ projectText, shipText: "", shipType: "OTHER" });
  const picks = BUCKET_PRIORITY.filter((t) => signals.has(t)).slice(0, 2);
  return picks.length > 0 ? picks.join("-") : "general";
}

/**
 * Full recompute of ChannelStat across all projects, bucketed by each project's
 * productTag. Cheap at MVP scale; would become an incremental Inngest job later.
 */
export async function rollupAllChannelStats(): Promise<void> {
  const posts = await db.post.findMany({
    include: {
      ship: {
        include: {
          project: { select: { name: true, description: true, url: true } },
        },
      },
      trackedLink: { include: { events: { select: { type: true } } } },
    },
  });

  const tagCache = new Map<string, string>();
  const acc = new Map<string, OutcomeSignal & { channelId: string; productTag: string }>();

  for (const post of posts) {
    const proj = post.ship.project;
    const projKey = `${proj.name}|${proj.url ?? ""}`;
    let tag = tagCache.get(projKey);
    if (!tag) {
      tag = productTagFor(`${proj.name} ${proj.description ?? ""} ${proj.url ?? ""}`);
      tagCache.set(projKey, tag);
    }

    const key = `${post.channelId}::${tag}`;
    const row =
      acc.get(key) ??
      { channelId: post.channelId, productTag: tag, posts: 0, clicks: 0, signups: 0, removals: 0 };

    row.posts += 1;
    if (post.status === "REMOVED") row.removals += 1;
    for (const e of post.trackedLink?.events ?? []) {
      if (e.type === "CLICK") row.clicks += 1;
      else if (e.type === "SIGNUP") row.signups += 1;
    }
    acc.set(key, row);
  }

  // Replace the table with the freshly computed rollup.
  await db.$transaction([
    db.channelStat.deleteMany({}),
    db.channelStat.createMany({
      data: [...acc.values()].map((r) => ({
        channelId: r.channelId,
        productTag: r.productTag,
        posts: r.posts,
        clicks: r.clicks,
        signups: r.signups,
        removals: r.removals,
      })),
    }),
  ]);
}

/** Outcome signals for a bucket, keyed by channelId (for re-ranking). */
export async function getOutcomeSignals(
  productTag: string,
): Promise<Map<string, OutcomeSignal>> {
  const rows = await db.channelStat.findMany({ where: { productTag } });
  const map = new Map<string, OutcomeSignal>();
  for (const r of rows) {
    map.set(r.channelId, {
      posts: r.posts,
      clicks: r.clicks,
      signups: r.signups,
      removals: r.removals,
    });
  }
  return map;
}

/**
 * Fit-score adjustment from real outcomes (pure). Channels that convert for
 * similar products get a boost; channels that got removed get a penalty.
 */
export function outcomeBoost(signal?: OutcomeSignal): number {
  if (!signal) return 0;
  let boost = 0;
  if (signal.signups > 0) boost += Math.min(10, signal.signups * 2);
  if (signal.removals > 0) boost -= 5;
  return boost;
}
