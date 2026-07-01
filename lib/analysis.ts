import { z } from "zod";
import { db } from "./db";
import { completeJSON, llmConfigured } from "./llm";
import {
  matchChannels,
  type ChannelLike,
  type ScoredChannel,
} from "./channels";
import {
  productTagFor,
  rollupAllChannelStats,
  getOutcomeSignals,
  outcomeBoost,
} from "./stats";
import type { BanRisk, Channel, Project, Ship } from "@prisma/client";

/**
 * The analysis pipeline (the important one).
 *
 *   1. matchChannels() narrows the seeded catalog to candidates (constraint).
 *   2. Claude ranks + justifies each candidate for THIS ship & product.
 *   3. banRisk = max(channel.defaultBanRisk, outcome signal)  ← NOT from the LLM.
 *   4. persist DistributionPlan + Recommendation[].
 *
 * The LLM only ever sees — and can only rank — channels we hand it, so it can
 * never invent a community.
 */

const MAX_CANDIDATES = 10;

// ── LLM output contract ────────────────────────────────────
const RankingSchema = z.object({
  rankings: z
    .array(
      z.object({
        slug: z.string(),
        fitScore: z.number().int().min(0).max(100),
        why: z.string().min(1).max(400),
        ruleNote: z.string().min(1).max(200),
        // Models sometimes emit null; accept null/undefined and fall back to the
        // channel's catalog best time downstream.
        bestTime: z.string().max(80).nullish(),
      }),
    )
    .min(1),
});
export type RankingResult = z.infer<typeof RankingSchema>;

export type PlanInput = {
  project: Pick<Project, "name" | "description" | "url" | "githubRepo">;
  ship: Pick<Ship, "type" | "title" | "summary">;
};

/** System + user prompt for ranking. Pure → unit-testable without a network call. */
export function buildAnalysisPrompt(
  input: PlanInput,
  candidates: ChannelLike[],
) {
  const system = [
    "You are LaunchWake's distribution strategist for technical founders.",
    "You are given a product, one 'ship' (a release/feature/blog worth sharing), and a FIXED list of candidate channels from a curated catalog.",
    "Your job: rank the candidates by fit for THIS specific ship and product, and for each give a product-specific reason and the safe way to post there.",
    "",
    "Hard rules:",
    "- You may ONLY use channels from the provided candidate list. NEVER invent communities, subreddits, or platforms. Refer to each by its exact slug.",
    "- Ground the 'ruleNote' in the channel's stated rules — the concrete safe way in for this post (e.g. 'lead with the build story, no marketing tone').",
    "- 'why' must be specific to this product + ship, not generic. One or two sentences.",
    "- Do NOT assign ban risk; that is computed separately.",
    "- Respond with ONLY a JSON object, no prose, no code fences.",
    "",
    'JSON shape: {"rankings":[{"slug":string,"fitScore":0-100,"why":string,"ruleNote":string,"bestTime":string?}]}',
    "Rank every candidate you are given, best fit first.",
  ].join("\n");

  const productBlock = [
    `Product: ${input.project.name}`,
    input.project.description ? `Description: ${input.project.description}` : "",
    input.project.url ? `URL: ${input.project.url}` : "",
    input.project.githubRepo ? `GitHub: ${input.project.githubRepo}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const shipBlock = [
    `Ship type: ${input.ship.type}`,
    `Ship title: ${input.ship.title}`,
    input.ship.summary ? `Why it matters: ${input.ship.summary}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const candidateBlock = candidates
    .map((c, i) =>
      [
        `${i + 1}. slug=${c.slug} — ${c.name} [${c.platform}]`,
        c.audienceDesc ? `   audience: ${c.audienceDesc}` : "",
        c.bestTime ? `   best time: ${c.bestTime}` : "",
        c.rules ? `   rules: ${c.rules}` : "",
        `   tags: ${c.tags.join(", ")}`,
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n\n");

  const prompt = [
    "== PRODUCT ==",
    productBlock,
    "",
    "== SHIP TO DISTRIBUTE ==",
    shipBlock,
    "",
    "== CANDIDATE CHANNELS (rank only these, by slug) ==",
    candidateBlock,
  ].join("\n");

  return { system, prompt };
}

/**
 * Deterministic fallback ranking when no API key is set. Grounded in the same
 * catalog + tag-overlap score, so the app stays usable (and honest) offline.
 */
export function heuristicRank(
  scored: ScoredChannel[],
  input: PlanInput,
): RankingResult {
  const top = scored[0]?.score ?? 0;
  return {
    rankings: scored.map((s, i) => {
      // Map overlap score → 60..96 band; subtract rank index so equal-overlap
      // channels still form a clean descending order instead of tying.
      const norm = top > 0 ? s.score / top : 0;
      const fitScore = Math.max(60, Math.min(96, Math.round(60 + norm * 36 - i)));
      const rule = firstSentence(s.channel.rules) ?? "Value-first; follow the community norms.";
      const matched =
        s.matchedTags.length > 0
          ? s.matchedTags.slice(0, 3).join(", ")
          : "your audience";
      return {
        slug: s.channel.slug,
        fitScore,
        why: `${input.ship.title} fits ${s.channel.name}'s audience (${matched}). Frame it around the problem it solves for ${input.project.name}'s users.`,
        ruleNote: rule,
        bestTime: s.channel.bestTime ?? undefined,
      };
    }),
  };
}

function firstSentence(text?: string | null): string | undefined {
  if (!text) return undefined;
  const m = text.match(/^(.*?[.!?])(\s|$)/);
  return (m ? m[1] : text).slice(0, 160);
}

/** banRisk = max(catalog default, outcome signal). No LLM input. */
export function computeBanRisk(channel: Channel, removals = 0): BanRisk {
  if (channel.defaultBanRisk === "HIGH" || removals >= 2) return "HIGH";
  if (channel.defaultBanRisk === "MEDIUM" || removals >= 1) return "MEDIUM";
  return "LOW";
}

/**
 * Build (or rebuild) the distribution plan for a ship. Returns the plan id.
 */
export async function buildPlan(shipId: string): Promise<string> {
  const ship = await db.ship.findUnique({
    where: { id: shipId },
    include: { project: true },
  });
  if (!ship) throw new Error(`Ship ${shipId} not found`);

  const catalog = await db.channel.findMany();
  const scored = matchChannels(
    catalog,
    {
      projectText: `${ship.project.name} ${ship.project.description ?? ""} ${ship.project.url ?? ""}`,
      shipText: `${ship.title} ${ship.summary ?? ""}`,
      shipType: ship.type,
    },
    MAX_CANDIDATES,
  );

  const candidates = scored.map((s) => s.channel);
  const bySlug = new Map(catalog.map((c) => [c.slug, c]));

  const input: PlanInput = {
    project: ship.project,
    ship,
  };

  let ranking: RankingResult;
  if (llmConfigured()) {
    const { system, prompt } = buildAnalysisPrompt(input, candidates);
    ranking = await completeJSON({
      userId: ship.project.userId,
      system,
      prompt,
      schema: RankingSchema,
      label: "analysis",
    });
  } else {
    console.warn("[analysis] ANTHROPIC_API_KEY not set — using heuristic ranking.");
    ranking = heuristicRank(scored, input);
  }

  // Keep only rankings that reference a real candidate slug (drop hallucinations).
  const grounded = ranking.rankings.filter((r) => bySlug.has(r.slug));
  if (grounded.length === 0) {
    throw new Error("Analysis produced no valid recommendations.");
  }

  // Flywheel: refresh outcome stats and re-rank by real results for this product
  // profile. Channels that converted for similar products rise; removals raise
  // ban risk and apply a penalty.
  await rollupAllChannelStats();
  const productTag = productTagFor(
    `${ship.project.name} ${ship.project.description ?? ""} ${ship.project.url ?? ""}`,
  );
  const signals = await getOutcomeSignals(productTag);

  const enriched = grounded
    .map((r) => {
      const channel = bySlug.get(r.slug)!;
      const signal = signals.get(channel.id);
      const fitScore = Math.max(
        0,
        Math.min(100, r.fitScore + outcomeBoost(signal)),
      );
      return {
        channel,
        fitScore,
        banRisk: computeBanRisk(channel, signal?.removals ?? 0),
        bestTime: r.bestTime ?? channel.bestTime,
        whyText: r.why,
        ruleNote: r.ruleNote,
      };
    })
    .sort((a, b) => b.fitScore - a.fitScore);

  // Replace any existing plan for this ship (supports "Re-run").
  await db.distributionPlan.deleteMany({ where: { shipId } });

  const plan = await db.distributionPlan.create({
    data: {
      shipId,
      recs: {
        create: enriched.map((e, i) => ({
          channelId: e.channel.id,
          rank: i,
          fitScore: e.fitScore,
          banRisk: e.banRisk,
          bestTime: e.bestTime,
          whyText: e.whyText,
          ruleNote: e.ruleNote,
        })),
      },
    },
  });

  await db.ship.update({
    where: { id: shipId },
    data: { status: "PLANNED" },
  });

  return plan.id;
}
