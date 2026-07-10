import { db } from "./db";
import { deriveSignalTags } from "./channels";
import { sourcePlatform } from "./selfReport";

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
  // Consumer / visual-first product buckets (the short-form-eligible ones).
  "consumer",
  "game",
  "design",
  "b2c",
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
  const [posts, selfReports] = await Promise.all([
    db.post.findMany({
      include: {
        channel: { select: { id: true, platform: true } },
        ship: {
          include: {
            project: { select: { id: true, name: true, description: true, url: true } },
          },
        },
        trackedLink: { include: { events: { select: { type: true } } } },
      },
    }),
    db.selfReport.findMany({ select: { projectId: true, source: true } }),
  ]);

  // Reported signups per (project, platform) — survey answers mapped to a platform.
  const reportedByProjectPlatform = new Map<string, Map<string, number>>();
  for (const sr of selfReports) {
    const platform = sourcePlatform(sr.source);
    if (!platform) continue; // dark social has no channel to credit
    const byPlat = reportedByProjectPlatform.get(sr.projectId) ?? new Map<string, number>();
    byPlat.set(String(platform), (byPlat.get(String(platform)) ?? 0) + 1);
    reportedByProjectPlatform.set(sr.projectId, byPlat);
  }

  const tagCache = new Map<string, string>();
  type Row = OutcomeSignal & { channelId: string; productTag: string; reportedSignups: number };
  const acc = new Map<string, Row>();
  // Which distinct channels each project posted to, per platform — so a project's
  // platform-reported answers split across its channels without double-counting.
  const projectChannels = new Map<string, { tag: string; byPlatform: Map<string, Set<string>> }>();

  for (const post of posts) {
    const proj = post.ship.project;
    let tag = tagCache.get(proj.id);
    if (!tag) {
      tag = productTagFor(`${proj.name} ${proj.description ?? ""} ${proj.url ?? ""}`);
      tagCache.set(proj.id, tag);
    }

    const key = `${post.channelId}::${tag}`;
    const row =
      acc.get(key) ??
      {
        channelId: post.channelId,
        productTag: tag,
        posts: 0,
        clicks: 0,
        signups: 0,
        removals: 0,
        reportedSignups: 0,
      };

    row.posts += 1;
    if (post.status === "REMOVED") row.removals += 1;
    for (const e of post.trackedLink?.events ?? []) {
      if (e.type === "CLICK") row.clicks += 1;
      else if (e.type === "SIGNUP") row.signups += 1; // TRACKED signups only
    }
    acc.set(key, row);

    // Note the project→platform→channel mapping for the reported split below.
    const pc = projectChannels.get(proj.id) ?? { tag, byPlatform: new Map<string, Set<string>>() };
    const platform = String(post.channel.platform);
    const set = pc.byPlatform.get(platform) ?? new Set<string>();
    set.add(post.channelId);
    pc.byPlatform.set(platform, set);
    projectChannels.set(proj.id, pc);
  }

  // Split each project's platform-reported answers evenly across the channels it
  // posted to on that platform (floored — never inflates the platform's total).
  for (const [projectId, pc] of projectChannels) {
    const reported = reportedByProjectPlatform.get(projectId);
    if (!reported) continue;
    for (const [platform, channelIds] of pc.byPlatform) {
      const total = reported.get(platform) ?? 0;
      const per = channelIds.size > 0 ? Math.floor(total / channelIds.size) : 0;
      if (per === 0) continue;
      for (const channelId of channelIds) {
        const row = acc.get(`${channelId}::${pc.tag}`);
        if (row) row.reportedSignups += per;
      }
    }
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
        reportedSignups: r.reportedSignups,
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
  consumer: "consumer apps",
  game: "games",
  design: "design tools",
  b2c: "consumer apps",
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
  const postStr = `${signal.posts} post${signal.posts === 1 ? "" : "s"}`;

  let boost = 0;
  let note: string | null = null;

  if (signal.signups > 0) {
    // Proven converter — reward it.
    boost += Math.round(Math.min(12, conv * 100 * 1.5) * confidence);
    const convStr = conv > 0 ? `${(conv * 100).toFixed(1)}% conv` : `${signal.signups} signups`;
    note = `Proven: ${convStr} for ${label} (${postStr})`;
  } else if (signal.clicks >= 8) {
    // Got traffic but never converted — a real negative signal. Downrank and
    // say why, so the plan visibly learns from what didn't work.
    boost -= Math.round(Math.min(10, 3 + signal.clicks / 8) * confidence);
    note = `${signal.clicks} clicks but 0 signups for ${label} (${postStr}) — didn't convert`;
  }

  if (signal.removals > 0) {
    boost -= 4 + signal.removals;
    const removalNote = `${signal.removals} removal${signal.removals === 1 ? "" : "s"} on ${label} — post carefully`;
    note = note ? `${note} · ${removalNote}` : removalNote;
  }

  return { boost, note };
}

/**
 * A compact, factual outcome line for the analysis PROMPT (not the UI): the raw
 * numbers so the LLM can weight a channel by how it actually performed for
 * similar products. Returns null when there's no history yet.
 */
export function outcomeFactLine(
  signal: OutcomeSignal | undefined,
  productTag: string,
): string | null {
  if (!signal || signal.posts === 0) return null;

  const label = bucketLabel(productTag);
  const parts = [
    `${signal.posts} post${signal.posts === 1 ? "" : "s"}`,
    `${signal.clicks} click${signal.clicks === 1 ? "" : "s"}`,
    `${signal.signups} signup${signal.signups === 1 ? "" : "s"}`,
  ];
  if (signal.clicks > 0) {
    parts.push(`${((signal.signups / signal.clicks) * 100).toFixed(1)}% conversion`);
  }
  if (signal.removals > 0) {
    parts.push(`${signal.removals} removal${signal.removals === 1 ? "" : "s"}`);
  }
  return `past results for ${label}: ${parts.join(", ")}`;
}
