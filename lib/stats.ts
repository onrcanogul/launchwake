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

/** Human label for a product bucket ("devtools-webdev" → "dev-tools"). */
const BUCKET_LABELS: Record<string, string> = {
  devtools: "dev-tools",
  saas: "SaaS",
  webdev: "web-dev",
  devops: "DevOps",
  infra: "infra",
  ai: "AI",
  opensource: "open-source",
  selfhosted: "self-hosted",
  node: "Node",
  javascript: "JS",
  frontend: "frontend",
  backend: "backend",
  b2b: "B2B",
  founders: "founder",
  general: "products like yours",
};

export function bucketLabel(productTag: string): string {
  const first = productTag.split("-")[0];
  return BUCKET_LABELS[first] ?? "products like yours";
}

export type OutcomeEvidence = {
  /** fit-score adjustment (can be negative) */
  boost: number;
  /** legible evidence for the plan card, or null when there's no signal yet */
  note: string | null;
};

/**
 * Turn a channel's real outcomes into a fit adjustment + a legible note — the
 * flywheel made visible. Conversion-rate driven, ramped by sample size so a
 * single lucky post doesn't dominate. Removals penalise and are called out.
 */
export function outcomeEvidence(
  signal: OutcomeSignal | undefined,
  productTag: string,
): OutcomeEvidence {
  if (!signal || signal.posts === 0) return { boost: 0, note: null };

  const label = bucketLabel(productTag);
  const conv = signal.clicks > 0 ? signal.signups / signal.clicks : 0;
  // Confidence ramps from 0→1 as we accumulate up to ~5 posts of evidence.
  const confidence = Math.min(1, signal.posts / 5);

  let boost = 0;
  let note: string | null = null;

  if (signal.signups > 0) {
    boost += Math.round(Math.min(12, conv * 100 * 1.5) * confidence);
    const convStr = conv > 0 ? `${(conv * 100).toFixed(1)}% conv` : `${signal.signups} signups`;
    note = `Proven: ${convStr} for ${label} (${signal.posts} post${signal.posts === 1 ? "" : "s"})`;
  }

  if (signal.removals > 0) {
    boost -= 4 + signal.removals;
    const removalNote = `${signal.removals} removal${signal.removals === 1 ? "" : "s"} on ${label} — post carefully`;
    note = note ? `${note} · ${removalNote}` : removalNote;
  }

  return { boost, note };
}
