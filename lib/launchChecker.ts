/**
 * Launch Checker — the public, login-less lead magnet.
 *
 * Given a repo's public metadata (name/description) and, optionally, its latest
 * release/commit as a "ship", produce a grounded mini distribution plan from the
 * SAME seeded catalog the real product uses. No LLM call (cost = 0, instant), so
 * this can run on an unauthenticated, rate-limited endpoint. The full experience
 * (Claude ranking, drafts, attribution) lives behind signup.
 *
 * Pure + framework-agnostic → unit-testable. The route layer supplies the catalog
 * and the fetched repo/ship context.
 */

import { matchChannels, type ChannelLike } from "./channels";
import { heuristicRank, type PlanInput } from "./analysis";

/** How many recommendations we reveal for free before gating the rest. */
export const PUBLIC_FREE_RECS = 3;
/** How many candidates we rank at all (the teaser advertises the remainder). */
const PUBLIC_CANDIDATES = 8;

export type PublicRec = {
  slug: string;
  name: string;
  platform: string;
  audienceDesc: string | null;
  fitScore: number;
  banRisk: "LOW" | "MEDIUM" | "HIGH";
  why: string;
  ruleNote: string;
  bestTime: string | null;
};

export type PublicShip = {
  type: "LAUNCH" | "FEATURE" | "BLOG" | "OTHER";
  title: string;
  summary: string | null;
};

export type PublicPlanInput = {
  project: {
    name: string;
    description?: string | null;
    url?: string | null;
    githubRepo?: string | null;
  };
  /** Latest release/commit turned into a ship; null when the repo has neither. */
  ship?: PublicShip | null;
};

export type PublicPlan = {
  project: { name: string; description: string | null; url: string | null };
  ship: PublicShip | null;
  /** ALL ranked recs. The UI reveals the first PUBLIC_FREE_RECS and locks the rest. */
  recs: PublicRec[];
  /** Total channels in the catalog — for "N more channels" copy. */
  totalChannels: number;
};

/**
 * Rank the catalog for a repo and return a public mini-plan. Ban risk comes
 * straight from the catalog default (no per-user outcome data outside the app),
 * which keeps the public tool honest and never invents a community.
 */
export function buildPublicPlan(
  catalog: ChannelLike[],
  input: PublicPlanInput,
): PublicPlan {
  const ship: PublicShip = input.ship ?? {
    type: "LAUNCH",
    title: input.project.name,
    summary: input.project.description ?? null,
  };

  const scored = matchChannels(
    catalog,
    {
      projectText: `${input.project.name} ${input.project.description ?? ""} ${input.project.url ?? ""}`,
      shipText: `${ship.title} ${ship.summary ?? ""}`,
      shipType: ship.type,
    },
    PUBLIC_CANDIDATES,
  );

  const planInput: PlanInput = {
    project: {
      name: input.project.name,
      description: input.project.description ?? null,
      url: input.project.url ?? null,
      githubRepo: input.project.githubRepo ?? null,
    },
    ship: { type: ship.type, title: ship.title, summary: ship.summary ?? null },
  };

  const ranking = heuristicRank(scored, planInput);
  const bySlug = new Map(scored.map((s) => [s.channel.slug, s.channel]));

  const recs: PublicRec[] = ranking.rankings
    .map((r) => {
      const channel = bySlug.get(r.slug);
      if (!channel) return null;
      return {
        slug: channel.slug,
        name: channel.name,
        platform: channel.platform,
        audienceDesc: channel.audienceDesc ?? null,
        fitScore: r.fitScore,
        banRisk: channel.defaultBanRisk,
        why: r.why,
        ruleNote: r.ruleNote,
        bestTime: r.bestTime ?? channel.bestTime ?? null,
      } satisfies PublicRec;
    })
    .filter((r): r is PublicRec => r !== null)
    .sort((a, b) => b.fitScore - a.fitScore);

  return {
    project: {
      name: input.project.name,
      description: input.project.description ?? null,
      url: input.project.url ?? null,
    },
    ship: input.ship ?? null,
    recs,
    totalChannels: catalog.length,
  };
}
