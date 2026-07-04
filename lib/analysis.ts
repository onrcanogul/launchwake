import { z } from "zod";
import { db } from "./db";
import {
  completeJSON,
  llmConfigured,
  wrapUntrusted,
  UNTRUSTED_DATA_NOTICE,
} from "./llm";
import {
  matchChannels,
  outcomeWeight,
  type ChannelLike,
  type ScoredChannel,
} from "./channels";
import {
  productTagFor,
  rollupAllChannelStats,
  getOutcomeSignals,
  getProjectChannelOutcomes,
  outcomeEvidence,
  outcomeFactLine,
  projectOutcomeFactLine,
} from "./stats";
import { rollupBenchmarks, getBenchmarkSignals } from "./benchmarks";
import { generateQueueForShip } from "./queue";
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

/**
 * System + user prompt for ranking. Pure → unit-testable without a network call.
 *
 * `outcomeContext` (slug → factual past-results line) is the flywheel made
 * legible to the model: when we have real history for a channel, we hand the LLM
 * the numbers so it can re-weight (proven converters up, traffic-with-no-signups
 * and removals down) instead of ranking blind.
 */
export function buildAnalysisPrompt(
  input: PlanInput,
  candidates: ChannelLike[],
  outcomeContext?: Map<string, string>,
  opts?: { launchContext?: boolean },
) {
  const hasOutcomes = Boolean(outcomeContext && outcomeContext.size > 0);
  const system = [
    "You are LaunchWake's distribution strategist for technical founders.",
    "You are given a product, one 'ship' (a release/feature/blog worth sharing), and a FIXED list of candidate channels from a curated catalog.",
    "Your job: rank the candidates by fit for THIS specific ship and product, and for each give a product-specific reason and the safe way to post there.",
    "",
    "Hard rules:",
    "- You may ONLY use channels from the provided candidate list. NEVER invent communities, subreddits, or platforms. Refer to each by its exact slug.",
    "- Ground the 'ruleNote' in the channel's stated rules — the concrete safe way in for this post (e.g. 'lead with the build story, no marketing tone').",
    "- 'why' must be specific to this product + ship, not generic. One or two sentences.",
    opts?.launchContext
      ? "- This is a FIRST public launch. Favor launch venues (Product Hunt, Show HN, launch-friendly communities) — rank them higher than evergreen posting channels, and frame 'why' around making the launch land."
      : "",
    hasOutcomes
      ? "- Some candidates include a 'past results' line — REAL outcomes from posting similar products there. Weight it heavily: a channel that produced signups should rank higher; one that got clicks but ZERO signups, or had removals, should rank LOWER even if it looks topically relevant. When past results change the call, say so in 'why' (e.g. 'drove 4% signups for similar tools last time')."
      : "",
    "- Do NOT assign ban risk; that is computed separately.",
    "- Respond with ONLY a JSON object, no prose, no code fences.",
    "",
    UNTRUSTED_DATA_NOTICE,
    "",
    'JSON shape: {"rankings":[{"slug":string,"fitScore":0-100,"why":string,"ruleNote":string,"bestTime":string?}]}',
    "Rank every candidate you are given, best fit first.",
  ]
    .filter(Boolean)
    .join("\n");

  const productBlock = [
    `Product name: ${wrapUntrusted("product_name", input.project.name)}`,
    input.project.description
      ? `Description: ${wrapUntrusted("product_description", input.project.description)}`
      : "",
    input.project.url ? `URL: ${wrapUntrusted("product_url", input.project.url)}` : "",
    // githubRepo is validated to "owner/repo" upstream, so it's not free text.
    input.project.githubRepo ? `GitHub: ${input.project.githubRepo}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const shipBlock = [
    `Ship type: ${input.ship.type}`,
    `Ship title: ${wrapUntrusted("ship_title", input.ship.title)}`,
    input.ship.summary
      ? `Why it matters: ${wrapUntrusted("ship_summary", input.ship.summary)}`
      : "",
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
        outcomeContext?.get(c.slug) ? `   past results: ${outcomeContext.get(c.slug)}` : "",
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
 *
 * `launchContext` favors launch venues in ranking; when omitted it's derived
 * from the project's launch stage (pre-launch / unannounced → launch context).
 */
export async function buildPlan(
  shipId: string,
  opts?: { launchContext?: boolean },
): Promise<string> {
  const ship = await db.ship.findUnique({
    where: { id: shipId },
    include: { project: true },
  });
  if (!ship) throw new Error(`Ship ${shipId} not found`);

  const launchContext =
    opts?.launchContext ?? ship.project.launchStage !== "LAUNCHED";

  const catalog = await db.channel.findMany();

  // Flywheel, step 0 — refresh outcome stats for this product profile BEFORE
  // ranking, so real results shape candidate SELECTION as well as the final fit.
  // Channels that converted rise (even on thin tag overlap); traffic-with-no-
  // signup and removals sink out of the shortlist.
  await rollupAllChannelStats();
  // Refresh category benchmarks too (first-party only here — the public-engagement
  // bootstrap runs on the daily cron to keep plan-building network-free).
  await rollupBenchmarks().catch(() => {});

  const productTag = productTagFor(
    `${ship.project.name} ${ship.project.description ?? ""} ${ship.project.url ?? ""}`,
  );
  const [projectOutcomes, benchmarkSignals, signals] = await Promise.all([
    getProjectChannelOutcomes(ship.projectId),
    getBenchmarkSignals(productTag),
    getOutcomeSignals(productTag),
  ]);

  const scored = matchChannels(
    catalog,
    {
      projectText: `${ship.project.name} ${ship.project.description ?? ""} ${ship.project.url ?? ""}`,
      shipText: `${ship.title} ${ship.summary ?? ""}`,
      shipType: ship.type,
      launchContext,
      outcomes: { firstParty: projectOutcomes, benchmarks: benchmarkSignals },
    },
    MAX_CANDIDATES,
  );

  const candidates = scored.map((s) => s.channel);
  const bySlug = new Map(catalog.map((c) => [c.slug, c]));

  const input: PlanInput = {
    project: ship.project,
    ship,
  };

  // Per-candidate factual results line for the prompt (only where we have
  // history). Prefer the founder's OWN first-party numbers over the category
  // aggregate so the LLM weights what actually happened for this product.
  const outcomeContext = new Map<string, string>();
  for (const c of candidates) {
    const line =
      projectOutcomeFactLine(projectOutcomes.get(c.id)) ??
      outcomeFactLine(signals.get(c.id), productTag);
    if (line) outcomeContext.set(c.slug, line);
  }

  let ranking: RankingResult;
  if (llmConfigured()) {
    const { system, prompt } = buildAnalysisPrompt(input, candidates, outcomeContext, {
      launchContext,
    });
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

  // Flywheel, step 2 — apply the deterministic fit adjustment + legible evidence
  // and re-sort. The founder's OWN first-party history (and, failing that, the
  // category benchmark) takes precedence over the category conversion evidence,
  // so the plan visibly learns from what actually worked for this product. banRisk
  // also rises with removals — from either the project's or the category's history.
  const enriched = grounded
    .map((r) => {
      const channel = bySlug.get(r.slug)!;
      const firstParty = projectOutcomes.get(channel.id);
      const catSignal = signals.get(channel.id);
      const outcome = outcomeWeight(firstParty, benchmarkSignals.get(channel.id));
      const evidence = outcomeEvidence(catSignal, productTag);
      const boost = outcome.reason ? outcome.delta : evidence.boost;
      const fitScore = Math.max(0, Math.min(100, r.fitScore + boost));
      const removals = Math.max(
        catSignal?.removals ?? 0,
        firstParty?.removals ?? 0,
      );
      return {
        channel,
        fitScore,
        banRisk: computeBanRisk(channel, removals),
        bestTime: r.bestTime ?? channel.bestTime,
        whyText: r.why,
        ruleNote: r.ruleNote,
        outcomeNote: outcome.reason ?? evidence.note,
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
          outcomeNote: e.outcomeNote,
        })),
      },
    },
  });

  await db.ship.update({
    where: { id: shipId },
    data: { status: "PLANNED" },
  });

  // Lay down the sequenced distribution queue (week-1 directories → month-3
  // relaunch). Best-effort: a queue hiccup must not fail the plan build.
  await generateQueueForShip(shipId).catch(() => {});

  return plan.id;
}
