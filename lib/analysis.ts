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
  isShortformChannel,
  type ChannelLike,
  type ScoredChannel,
} from "./channels";
import { getProjectTagContext } from "./projectTags";
import { analysisLanguageRule, effectiveAudienceCode } from "./audience";
import { parseChannelCost, costPromptLine } from "./channelCost";
import {
  productTagFor,
  rollupAllChannelStats,
  getOutcomeSignals,
  outcomeEvidence,
  outcomeFactLine,
} from "./stats";
import { rollupBenchmarks } from "./benchmarks";
import { generateQueueForShip } from "./queue";
import { captureError } from "./observability";
import {
  parseAccountRequirements,
  computeAccountReadiness,
} from "./accountReadiness";
import type { BanRisk, Channel, Project, Ship } from "@prisma/client";

/**
 * The analysis pipeline (the important one).
 *
 *   1. matchChannels() ranks the seeded catalog; selectCandidates() takes the top
 *      slice PLUS every short-form channel, so the LLM always judges short-form.
 *   2. Claude ranks + justifies each candidate for THIS ship & product.
 *   3. dropLowFitShortform() removes short-form the model scored below the floor.
 *   4. banRisk = max(channel.defaultBanRisk, outcome signal)  ← NOT from the LLM.
 *   5. persist DistributionPlan + Recommendation[].
 *
 * The LLM only ever sees — and can only rank — channels we hand it, so it can
 * never invent a community. It DOES decide short-form fit (there's no hard gate).
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
  opts?: { launchContext?: boolean; audienceCode?: string },
) {
  const hasOutcomes = Boolean(outcomeContext && outcomeContext.size > 0);
  // Only include the short-form judgment rule when there are actually short-form
  // candidates to judge, so it never bloats an all-text-channel prompt.
  const hasShortform = candidates.some(isShortformChannel);
  const system = [
    "You are LaunchWake's distribution strategist for technical founders.",
    "You are given a product, one 'ship' (a release/feature/blog worth sharing), and a FIXED list of candidate channels from a curated catalog.",
    "Your job: rank the candidates by fit for THIS specific ship and product, and for each give a product-specific reason and the safe way to post there.",
    "",
    "Hard rules:",
    "- You may ONLY use channels from the provided candidate list. NEVER invent communities, subreddits, or platforms. Refer to each by its exact slug.",
    "- Ground the 'ruleNote' in the channel's stated rules — the concrete safe way in for this post (e.g. 'lead with the build story, no marketing tone').",
    "- 'why' must be specific to this product + ship, not generic. One or two sentences.",
    // Localize the rationale AND bias ranking toward the target audience's
    // language. Empty for an English audience (the prompt already defaults to it).
    analysisLanguageRule(opts?.audienceCode ?? "en"),
    opts?.launchContext
      ? "- This is a FIRST public launch. Favor launch venues (Product Hunt, Show HN, launch-friendly communities) — rank them higher than evergreen posting channels, and frame 'why' around making the launch land."
      : "",
    hasOutcomes
      ? "- Some candidates include a 'past results' line — REAL outcomes from posting similar products there. Weight it heavily: a channel that produced signups should rank higher; one that got clicks but ZERO signups, or had removals, should rank LOWER even if it looks topically relevant. When past results change the call, say so in 'why' (e.g. 'drove 4% signups for similar tools last time')."
      : "",
    "- Some candidates include a 'cost' line (paid or freemium). Do NOT down-rank a channel because it costs money — rank on fit as usual. But when you recommend a paid or freemium channel, state the cost plainly in 'why' (e.g. 'submission starts at $39') so the founder can weigh spend against fit. Free channels need no cost mention.",
    hasShortform
      ? "- Some candidates are SHORT-FORM VIDEO channels (TikTok, Instagram Reels, YouTube Shorts) — their tags include 'shortform' and their 'rules' field is FORMAT guidance, not community rules. Treat short-form as a VIABLE channel for MOST products and score it on merit: any product with a visual, demoable, or 'show don't tell' angle and a consumer or prosumer audience (apps, games, design/photo/video/creative tools, e-commerce, content, education, health, consumer fintech — and most products with a real UI) should score it genuinely well. Give short-form a LOW fitScore (under 40, so it is dropped from the plan) ONLY for a product with essentially nothing to show on camera — a pure CLI, an API, an SDK, or a headless backend/infra/devops tool. A B2B SaaS with a usable UI is a middle case: a founder-POV or product-demo clip is a stretch but can work, so score it modestly (keep it in) rather than dropping it. When short-form fits, the 'why' MUST be about the visual demo format for THIS product specifically — a 2-second hook, a screen-recorded demo, a trending sound — and it must acknowledge the attribution ceiling (no clickable links in posts; bio-link only; expect weak tracked attribution). The 'ruleNote' should be the concrete format tip (e.g. 'open on the payoff in the first 2 seconds')."
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
    .map((c, i) => {
      const costLine = costPromptLine(parseChannelCost(c.cost));
      return [
        `${i + 1}. slug=${c.slug} — ${c.name} [${c.platform}]`,
        c.audienceDesc ? `   audience: ${c.audienceDesc}` : "",
        c.bestTime ? `   best time: ${c.bestTime}` : "",
        c.rules ? `   rules: ${c.rules}` : "",
        `   tags: ${c.tags.join(", ")}`,
        costLine ? `   cost: ${costLine}` : "",
        outcomeContext?.get(c.slug) ? `   past results: ${outcomeContext.get(c.slug)}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    })
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
      const isSf = isShortformChannel(s.channel);
      // Offline there is no LLM to judge short-form fit, so fall back to tag
      // overlap: a short-form channel that matched none of the product's
      // visual/consumer tags is not a fit — give it a sub-floor score so the
      // SHORTFORM_FIT_FLOOR drops it (mirrors what the LLM does online).
      const shortformMiss = isSf && s.matchedTags.length === 0;
      // Map overlap score → 60..96 band; subtract rank index so equal-overlap
      // channels still form a clean descending order instead of tying.
      const norm = top > 0 ? s.score / top : 0;
      const fitScore = shortformMiss
        ? 20
        : Math.max(60, Math.min(96, Math.round(60 + norm * 36 - i)));
      const rule = firstSentence(s.channel.rules) ?? "Value-first; follow the community norms.";
      const matched =
        s.matchedTags.length > 0
          ? s.matchedTags.slice(0, 3).join(", ")
          : "your audience";
      // Keep the offline path honest about spend too — surface any cost in 'why'.
      const cost = parseChannelCost(s.channel.cost);
      const costSentence =
        cost.type === "paid"
          ? ` Paid channel${cost.note ? ` (${cost.note})` : ""}.`
          : cost.type === "freemium"
            ? ` Free option with paid tiers${cost.note ? ` (${cost.note})` : ""}.`
            : "";
      // For a short-form channel that DID match (a genuine visual/consumer fit),
      // lead the why-line with the demo/format angle specifically — not the
      // generic template. A miss keeps the format line too, but its sub-floor
      // score means it is dropped before it ever surfaces.
      const why = isSf
        ? shortformWhy(s.channel.name, input.project.name)
        : `${input.ship.title} fits ${s.channel.name}'s audience (${matched}). Frame it around the problem it solves for ${input.project.name}'s users.${costSentence}`;
      return {
        slug: s.channel.slug,
        fitScore,
        why,
        ruleNote: rule,
        bestTime: s.channel.bestTime ?? undefined,
      };
    }),
  };
}

/**
 * Deterministic why-line for a short-form video channel — leads with the FORMAT
 * (a 2-second hook + a screen-recorded demo) and stays honest about the bio-link-
 * only attribution ceiling these platforms impose. Used for short-form channels
 * that cleared the offline tag-overlap fit check; misses are dropped upstream.
 */
function shortformWhy(channelName: string, productName: string): string {
  const name = productName.trim() || "your product";
  return `Show ${name} in action: a 2-second hook plus a screen-recorded demo is the format ${channelName} rewards — post the video, not a link (bio-link only, so expect weak tracked attribution).`;
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
 * Assemble the LLM candidate set: the top `limit` channels by heuristic fit, PLUS
 * every short-form channel not already in that slice. This is what lets the AI
 * decide short-form fit on EVERY plan — a short-form channel always reaches the
 * model even when tag overlap alone wouldn't have floated it into the top slice.
 * Pure → unit-testable.
 */
export function selectCandidates<C extends ChannelLike>(
  ranked: ScoredChannel<C>[],
  limit: number,
): ScoredChannel<C>[] {
  const top = ranked.slice(0, limit);
  const inTop = new Set(top.map((s) => s.channel.slug));
  const shortformExtras = ranked.filter(
    (s) => isShortformChannel(s.channel) && !inTop.has(s.channel.slug),
  );
  return [...top, ...shortformExtras];
}

/**
 * Minimum fitScore a short-form channel needs to stay in a plan. The prompt biases
 * INCLUSIVE — short-form is a valid channel for most products — so below the floor
 * lands only a product with nothing to show on camera (a pure CLI/API/SDK/headless
 * backend), where a video channel would be a weak, misleading suggestion. Products
 * with any visual angle (incl. most SaaS with a UI) score above it and stay.
 */
export const SHORTFORM_FIT_FLOOR = 40;

/**
 * Drop short-form recommendations scored below the fit floor. Non-short-form
 * channels are never floored — they keep the full ranked list. Pure → testable.
 */
export function dropLowFitShortform<
  T extends { channel: Pick<ChannelLike, "tags">; fitScore: number },
>(recs: T[]): T[] {
  return recs.filter(
    (r) => !isShortformChannel(r.channel) || r.fitScore >= SHORTFORM_FIT_FLOOR,
  );
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

  // Effective output language: this ship's override, else the project default.
  // Drives the language of the generated 'why'/'ruleNote' and the ranking bias.
  const audienceCode = effectiveAudienceCode(
    ship.audienceLanguage,
    ship.project.audienceLanguage,
  );

  // Assemble the channel-fit context through the shared helper (keyword signals
  // over the product + ship text — no product-type classification).
  const { ctx } = await getProjectTagContext(ship.project, {
    ship,
    shipType: ship.type,
    launchContext,
  });

  const catalog = await db.channel.findMany();
  // Rank the full catalog, then take the top slice PLUS every short-form channel
  // (selectCandidates), so the LLM ALWAYS gets to judge short-form fit for this
  // ship. Short-form recs it scores below SHORTFORM_FIT_FLOOR are dropped below.
  const scored = selectCandidates(
    matchChannels(catalog, ctx, catalog.length),
    MAX_CANDIDATES,
  );

  const candidates = scored.map((s) => s.channel);
  const bySlug = new Map(catalog.map((c) => [c.slug, c]));

  // No candidates means the channel catalog is empty (unseeded DB) — matchChannels
  // always returns something when the catalog is non-empty. Fail with an operator-
  // actionable message instead of an opaque "no valid recommendations" downstream.
  if (candidates.length === 0) {
    throw new Error(
      "The channel catalog is empty — run `pnpm db:seed` to seed it before building plans.",
    );
  }

  const input: PlanInput = {
    project: ship.project,
    ship,
  };

  // Flywheel, step 1 — refresh outcome stats for this product profile BEFORE
  // ranking, so both the LLM (via the prompt) and the deterministic pass weight
  // what actually happened. Channels that converted rise; traffic-with-no-signup
  // and removals sink.
  await rollupAllChannelStats();
  // Refresh category benchmarks too (first-party only here — the public-engagement
  // bootstrap runs on the daily cron to keep plan-building network-free).
  await rollupBenchmarks().catch(() => {});
  const productTag = productTagFor(
    `${ship.project.name} ${ship.project.description ?? ""} ${ship.project.url ?? ""}`,
  );
  const signals = await getOutcomeSignals(productTag);

  // Per-candidate factual results line for the prompt (only where we have history).
  const outcomeContext = new Map<string, string>();
  for (const c of candidates) {
    const line = outcomeFactLine(signals.get(c.id), productTag);
    if (line) outcomeContext.set(c.slug, line);
  }

  let ranking: RankingResult;
  if (llmConfigured()) {
    const { system, prompt } = buildAnalysisPrompt(input, candidates, outcomeContext, {
      launchContext,
      audienceCode,
    });
    try {
      ranking = await completeJSON({
        userId: ship.project.userId,
        system,
        prompt,
        schema: RankingSchema,
        label: "analysis",
      });
    } catch (err) {
      // The LLM is configured but this call failed — daily budget exhausted, a
      // provider/API error, or invalid JSON after the repair retry. Never leave
      // the founder without a plan: fall back to the deterministic, catalog-
      // grounded ranking so the plan page always renders something real (the
      // requirement is a heuristic fallback, never a blank screen). Capture the
      // failure so a misconfigured key in prod is still visible in Sentry.
      captureError(err, { at: "analysis.buildPlan", shipId, reason: "llm_ranking_fallback" });
      console.warn(
        `[analysis] LLM ranking failed — falling back to heuristic ranking: ${(err as Error).message}`,
      );
      ranking = heuristicRank(scored, input);
    }
  } else {
    console.warn("[analysis] LLM not configured — using heuristic ranking.");
    ranking = heuristicRank(scored, input);
  }

  // Keep only rankings that reference a real candidate slug (drop hallucinations).
  const grounded = ranking.rankings.filter((r) => bySlug.has(r.slug));
  if (grounded.length === 0) {
    throw new Error("Analysis produced no valid recommendations.");
  }

  // Flywheel, step 2 — apply the deterministic fit adjustment + legible evidence
  // and re-sort. banRisk also rises with removals. Reuses the signals above.
  //
  // In launch context we ALSO apply a small account-readiness penalty: if the
  // launch date is set and too soon to prepare a credible account for a channel
  // (fresh-account ban risk), that channel drops in the ranking so safer venues
  // surface first. When no launch date is set yet, no penalty applies (graceful).
  const now = new Date();
  const enriched = grounded
    .map((r) => {
      const channel = bySlug.get(r.slug)!;
      const signal = signals.get(channel.id);
      const evidence = outcomeEvidence(signal, productTag);
      const readiness = launchContext
        ? computeAccountReadiness(
            parseAccountRequirements(channel.accountRequirements),
            { launchAt: ship.launchAt, now, channelName: channel.name },
          )
        : null;
      const fitScore = Math.max(
        0,
        Math.min(100, r.fitScore + evidence.boost - (readiness?.fitPenalty ?? 0)),
      );
      return {
        channel,
        fitScore,
        banRisk: computeBanRisk(channel, signal?.removals ?? 0),
        bestTime: r.bestTime ?? channel.bestTime,
        whyText: r.why,
        ruleNote: r.ruleNote,
        outcomeNote: evidence.note,
      };
    })
    .sort((a, b) => b.fitScore - a.fitScore);

  // Drop short-form channels the ranker judged a poor fit for this product (below
  // SHORTFORM_FIT_FLOOR) — this is where "the AI decides" becomes the plan: a
  // devtool's TikTok/Reels/Shorts fall away instead of trailing the plan. Fall
  // back to the full list on the (impossible) chance everything got floored.
  const floored = dropLowFitShortform(enriched);
  const finalRecs = floored.length > 0 ? floored : enriched;

  // Replace any existing plan for this ship (supports "Re-run").
  await db.distributionPlan.deleteMany({ where: { shipId } });

  const plan = await db.distributionPlan.create({
    data: {
      shipId,
      recs: {
        create: finalRecs.map((e, i) => ({
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
