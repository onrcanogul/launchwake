/**
 * Launch Checker — the public, login-less lead magnet.
 *
 * Given a repo's public metadata (name/description/topics/language) and,
 * optionally, its latest RELEASE as a "ship", produce a grounded mini distribution
 * plan from the SAME seeded catalog the real product uses. Raw commits are never
 * used here: on the public tool there is no human in the loop to correct a noisy
 * `chore:`/`wip` message, so we rank the PROJECT and only let a real release (an
 * intentional ship) refine it.
 *
 * `buildPublicPlan` is PURE + framework-agnostic → unit-testable, and runs with no
 * network call so it's free and instant on an unauthenticated, rate-limited
 * endpoint. It carries improved heuristic why-lines by default. The route may then
 * optionally enrich the revealed cards with ONE batched, budget-capped LLM call
 * (`enrichPublicPlanWhy`) for product-specific angles; on any failure the heuristic
 * copy stands. The full experience (Claude ranking, drafts, attribution) lives
 * behind signup.
 */

import { z } from "zod";
import { matchChannels, type ChannelLike } from "./channels";
import { heuristicRank, type PlanInput } from "./analysis";
import {
  completeJSON,
  llmConfigured,
  wrapUntrusted,
  UNTRUSTED_DATA_NOTICE,
} from "./llm";
import { captureError } from "./observability";

/** How many recommendations we reveal for free before gating the rest. */
export const PUBLIC_FREE_RECS = 3;
/** How many candidates we rank at all (the teaser advertises the remainder). */
const PUBLIC_CANDIDATES = 8;
/**
 * When the product context is thin, we lead with only this many (safe, broadly
 * useful) picks rather than padding the reveal with weak topical matches.
 */
const PUBLIC_THIN_RECS = 2;
/**
 * Minimum number of PRODUCT-SPECIFIC matched tags (excluding the universal
 * signals every technical launch gets) for us to trust the ranking. Below this
 * we're mostly guessing, so we show fewer cards + an honest "add a description"
 * note instead of pretending a weak match is a real one.
 */
const PUBLIC_MIN_MATCH_STRENGTH = 1;
/**
 * Signals every technical launch earns regardless of what the product actually
 * is — a baseline "developers" tag plus the launch/product ship-type tags. They
 * don't tell us anything specific, so they're excluded when measuring how well we
 * actually understand the product (see thin-context detection).
 */
const UNIVERSAL_TAGS = new Set(["developers", "launch", "product"]);

/**
 * Synthetic user bucket for the public checker's LLM spend. The public endpoint
 * has no signed-in user, so all its why-line calls accumulate under this one id
 * in `LlmUsageDay` — capping the whole public path with the SAME durable daily
 * budget guard the app uses per user (a scripted caller can't run up the bill).
 */
export const PUBLIC_LLM_USER = "public:launch-checker";

export type PublicRec = {
  slug: string;
  name: string;
  platform: string;
  audienceDesc: string | null;
  fitScore: number;
  banRisk: "LOW" | "MEDIUM" | "HIGH";
  why: string;
  ruleNote: string;
  /** One concrete cautionary line pulled from the channel's rules (or null). */
  ruleHighlight: string | null;
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
    /** GitHub topics — the owner's own tags; the strongest structured fit signal. */
    topics?: string[];
    /** Primary language — a light additional fit signal. */
    language?: string | null;
  };
  /** Latest RELEASE turned into a ship; null → project-level plan (no raw commits). */
  ship?: PublicShip | null;
};

export type PublicPlan = {
  project: { name: string; description: string | null; url: string | null };
  ship: PublicShip | null;
  /** ALL ranked recs. The UI reveals the first PUBLIC_FREE_RECS and locks the rest. */
  recs: PublicRec[];
  /** Total channels in the catalog — for "N more channels" copy. */
  totalChannels: number;
  /**
   * True when we couldn't find enough product-specific signal to rank
   * confidently. The UI then shows fewer cards + a "sign up to add a description"
   * note instead of padding with weak matches.
   */
  thinContext: boolean;
};

// ── Ban-risk-aware ordering ────────────────────────────────
const RISK_ORDER: Record<PublicRec["banRisk"], number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
};

/**
 * Ranking honesty: the free teaser must LEAD with channels a founder can post to
 * safely. A HIGH ban-risk channel (heavily-moderated subs, ban-happy forums) is
 * demoted below EVERY non-HIGH channel regardless of topical fit, so it can never
 * occupy a revealed top slot while a safer option exists. Within a risk band we
 * order by fit (then name for stability). Fit score stays a pure topical signal —
 * ban risk is shown to the user separately, never folded into the number.
 */
function compareRecs(a: PublicRec, b: PublicRec): number {
  const aHigh = a.banRisk === "HIGH" ? 1 : 0;
  const bHigh = b.banRisk === "HIGH" ? 1 : 0;
  if (aHigh !== bHigh) return aHigh - bHigh;
  if (b.fitScore !== a.fitScore) return b.fitScore - a.fitScore;
  return a.name.localeCompare(b.name);
}

// ── Task 1: surprise-rule surfacing ────────────────────────

/**
 * Regex → weight table for scoring how CONCRETE and ACTIONABLE a rule clause is.
 * A founder benefits far more from "new accounts must wait one week" or "link in
 * the first comment" than from the polite opener ("share genuinely useful
 * content"). Higher weight = more surprising / more likely to get you removed if
 * you don't know it. Order-independent; a clause's score is the sum of hits.
 */
const RULE_SIGNALS: { re: RegExp; weight: number }[] = [
  // Posting mechanics that silently kill reach / get you removed.
  { re: /link in (?:the )?first comment/i, weight: 6 },
  { re: /first comment/i, weight: 3 },
  { re: /links? (?:can|often|are) (?:suppress|throttl|flagged|removed)/i, weight: 3 },
  { re: /no links? in (?:the )?title|link-in-title|links in titles/i, weight: 3 },
  // Account-age / karma / standing gates — the classic "why can't I post" trap.
  { re: /\b(?:account age|account standing|fresh account|new accounts?)\b/i, weight: 5 },
  { re: /\bkarma\b/i, weight: 4 },
  { re: /\b(?:one|two|three|1|2|3|7|14|30|60|90)\s+(?:day|days|week|weeks|month|months|business day)/i, weight: 4 },
  { re: /\bwait\b/i, weight: 2 },
  { re: /invite[- ]?only|invite from|gated|earn (?:them|privileges)|can'?t (?:create )?posts?/i, weight: 4 },
  // Promo caps / ratios.
  { re: /90\/10|10%|~?10%|at most once a week|once a week per|under ~?10%/i, weight: 5 },
  // Designated threads / days / channels — post in the wrong place = removed.
  { re: /self[- ]?promotion saturday|showoff saturday|showcase saturday|work it wednesday|share your startup|small projects/i, weight: 5 },
  { re: /weekly (?:thread|threads|show|sticky|promo)|weekly '|pinned weekly|sticky thread/i, weight: 4 },
  { re: /#[a-z][a-z0-9-]+|dedicated (?:#?[a-z-]+ )?(?:showcase|show-and-tell|self-promo|projects?) channel|show-and-tell|showcase channel/i, weight: 3 },
  { re: /\b(?:mondays?|tuesdays?|wednesdays?|thursdays?|fridays?|saturdays?|sundays?)\b/i, weight: 3 },
  // Required formats / flair.
  { re: /showcase format|what my project does|required '?showcase'?|title format|flair(?:ed)?|corporate blog/i, weight: 3 },
  // Explicit consequences.
  { re: /\b(?:permanent ban|will result in a ban|purged|suspension)\b/i, weight: 5 },
  { re: /\b(?:banned?|removed|deleted|flagged)\b/i, weight: 2 },
  // Money.
  { re: /\$\d|paid[- ]only|paid membership|from \$\d/i, weight: 4 },
];

/** Split a rules blob into candidate clauses (sentences + semicolon clauses). */
function ruleClauses(rules: string): string[] {
  return rules
    .split(/(?<=[.!?])\s+|;\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function scoreClause(clause: string): number {
  let score = 0;
  for (const { re, weight } of RULE_SIGNALS) {
    if (re.test(clause)) score += weight;
  }
  // A concrete number anywhere is a mild specificity signal on its own.
  if (/\d/.test(clause)) score += 1;
  return score;
}

/** Trim a clause for display: collapse whitespace, tidy fragments, end cleanly. */
function tidyHighlight(clause: string): string {
  let out = clause.replace(/\s+/g, " ").trim();
  // A semicolon split can strand an unbalanced ")" from a parenthetical (possibly
  // before the sentence's period) — drop the last one so it doesn't read broken.
  const opens = (out.match(/\(/g) ?? []).length;
  const closes = (out.match(/\)/g) ?? []).length;
  if (closes > opens) out = out.replace(/\)(?=[.!?…\s]*$)/, "").trim();
  // Capitalize a clause that began mid-sentence (e.g. after a semicolon).
  out = out.replace(/^([a-z])/, (m) => m.toUpperCase());
  if (out.length > 150) {
    out = out.slice(0, 149).replace(/[\s,;:.!?-]+$/, "") + "…";
  } else if (!/[.!?…]$/.test(out)) {
    out += ".";
  }
  return out;
}

/**
 * Pick the single most specific / actionable cautionary line from a channel's
 * rules — NOT just the first sentence, which is almost always the friendly
 * "sharing your work is welcome" preamble. We score each clause by how concrete
 * and consequential it is (account-age gates, "link in first comment", weekly
 * threads, promo caps, ban warnings) and return the strongest. Ties break toward
 * the earlier clause. Returns null when there's no rules text at all.
 *
 * Pure → unit-testable.
 */
export function extractRuleHighlight(
  rules: string | null | undefined,
): string | null {
  if (!rules || !rules.trim()) return null;
  const clauses = ruleClauses(rules);
  if (clauses.length === 0) return null;

  let best = clauses[0];
  let bestScore = scoreClause(clauses[0]);
  for (let i = 1; i < clauses.length; i++) {
    const s = scoreClause(clauses[i]);
    // Strictly greater so ties keep the earlier (usually more general) clause,
    // letting a genuinely specific later clause win only when it out-scores it.
    if (s > bestScore) {
      best = clauses[i];
      bestScore = s;
    }
  }
  return tidyHighlight(best);
}

// ── Task 2: product-specific why-lines ─────────────────────

/**
 * Improved heuristic why-line. Product-specific enough to feel written for THIS
 * repo, keyed by the channel's platform so no two revealed cards read the same,
 * and — critically — grounded in the product NAME, never a raw ship title (which
 * for a release is often a bare version string like "v0.1.6.2"). This is the
 * always-available fallback when the LLM is unconfigured or fails.
 *
 * Pure → unit-testable.
 */
export function heuristicWhy(
  platform: string,
  productName: string,
  channelName: string,
): string {
  const name = productName.trim() || "your product";
  switch (platform) {
    case "HACKERNEWS":
    case "LOBSTERS":
      return `Post ${name} as a real build story — ${channelName}'s technical, skeptical readers reward substance over a pitch.`;
    case "REDDIT":
      return `${name} fits ${channelName}, but lead with the problem it solves and drop the marketing tone — this sub removes anything that reads as an ad.`;
    case "PRODUCTHUNT":
    case "DIRECTORY":
      return `List ${name} on ${channelName} with a crisp tagline and a working demo; the early adopters here are browsing for exactly this.`;
    case "X":
    case "BLUESKY":
    case "MASTODON":
      return `Open with a sharp hook about the problem ${name} solves — ${channelName} rewards a thread you engage with over a bare launch link.`;
    case "DEVTO":
    case "BLOG":
    case "NEWSLETTER":
      return `Turn ${name}'s story into a genuine technical write-up for ${channelName} — teach first, mention the product once.`;
    case "DISCORD":
    case "SLACK":
    case "FORUM":
      return `Share ${name} in ${channelName}'s show-and-tell channel and stay to answer questions; drive-by links get removed.`;
    case "LINKEDIN":
      return `Frame ${name} around the business outcome for ${channelName}'s professional audience, and keep the link out of the post body.`;
    case "INDIEHACKERS":
      return `Share ${name}'s numbers and what you learned building it on ${channelName} — transparency lands here where pure promotion is ignored.`;
    default:
      return `${name} is a strong fit for ${channelName} — lead with the concrete problem it solves for their audience.`;
  }
}

/** One revealed card's identity, as handed to the LLM why-line writer. */
type WhyCandidate = {
  slug: string;
  name: string;
  platform: string;
  audienceDesc: string | null;
};

const PublicWhySchema = z.object({
  lines: z
    .array(
      z.object({
        slug: z.string(),
        why: z.string().min(1).max(240),
      }),
    )
    .min(1),
});
export type PublicWhyResult = z.infer<typeof PublicWhySchema>;

/**
 * System + user prompt for the batched why-line call. Pure → unit-testable
 * without a network call. All user-controlled text (name, description, ship
 * title/summary) flows through `wrapUntrusted`, and the system prompt carries the
 * untrusted-data contract, so a prompt-injection attempt in a repo description
 * can't change the task. Output is still zod-validated by the caller.
 */
export function buildPublicWhyPrompt(
  project: { name: string; description?: string | null },
  ship: PublicShip | null,
  candidates: WhyCandidate[],
) {
  const system = [
    "You are LaunchWake's distribution strategist for technical founders.",
    "You are given a product, optionally its latest release, and a FIXED list of channels already chosen for it.",
    "For EACH channel, write ONE short sentence (max ~30 words) explaining the specific angle for posting THIS product there — grounded in what the product actually does.",
    "",
    "Hard rules:",
    "- Refer to the product by its NAME. Never quote raw version strings, tags, or release numbers (e.g. 'v0.1.6.2').",
    "- Be specific to this product and channel; no generic filler that would fit any product.",
    "- Only write for the exact slugs provided. Do not invent channels.",
    "- Respond with ONLY a JSON object, no prose, no code fences.",
    "",
    UNTRUSTED_DATA_NOTICE,
    "",
    'JSON shape: {"lines":[{"slug":string,"why":string}]}',
  ].join("\n");

  const productBlock = [
    `Product name: ${wrapUntrusted("product_name", project.name)}`,
    project.description
      ? `Description: ${wrapUntrusted("product_description", project.description)}`
      : "",
    ship ? `Latest release title: ${wrapUntrusted("ship_title", ship.title)}` : "",
    ship?.summary
      ? `Release notes: ${wrapUntrusted("ship_summary", ship.summary)}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const channelBlock = candidates
    .map((c, i) =>
      [
        `${i + 1}. slug=${c.slug} — ${c.name} [${c.platform}]`,
        c.audienceDesc ? `   audience: ${c.audienceDesc}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n");

  const prompt = [
    "== PRODUCT ==",
    productBlock,
    "",
    "== CHANNELS (write one why-line per slug) ==",
    channelBlock,
  ].join("\n");

  return { system, prompt };
}

/**
 * ONE batched, cheap LLM call that writes a product-specific why-line for every
 * revealed card. Spends under the synthetic public budget bucket. Returns a
 * slug→why map (only for slugs we asked about). Throws on any provider/budget/
 * validation failure so the caller can fall back to the heuristic copy.
 */
export async function generatePublicWhyLines(
  project: { name: string; description?: string | null },
  ship: PublicShip | null,
  candidates: WhyCandidate[],
): Promise<Map<string, string>> {
  const { system, prompt } = buildPublicWhyPrompt(project, ship, candidates);
  const result = await completeJSON({
    userId: PUBLIC_LLM_USER,
    system,
    prompt,
    schema: PublicWhySchema,
    // One short sentence per (≤3) card — a few hundred tokens is plenty.
    maxTokens: 400,
    label: "public-why",
  });

  const allowed = new Set(candidates.map((c) => c.slug));
  const map = new Map<string, string>();
  for (const line of result.lines) {
    const why = line.why.trim();
    if (allowed.has(line.slug) && why) map.set(line.slug, why);
  }
  return map;
}

/**
 * Enrich a plan's REVEALED cards (only the free ones) with product-specific
 * why-lines from a single LLM call. Never throws and never blocks the funnel: if
 * the LLM is unconfigured, over budget, or errors, the improved heuristic
 * why-lines from `buildPublicPlan` stand. Returns a new plan (or the same one).
 */
export async function enrichPublicPlanWhy(plan: PublicPlan): Promise<PublicPlan> {
  if (!llmConfigured()) return plan;
  const revealed = plan.recs.slice(0, PUBLIC_FREE_RECS);
  if (revealed.length === 0) return plan;

  try {
    const lines = await generatePublicWhyLines(
      plan.project,
      plan.ship,
      revealed.map((r) => ({
        slug: r.slug,
        name: r.name,
        platform: r.platform,
        audienceDesc: r.audienceDesc,
      })),
    );
    if (lines.size === 0) return plan;
    return {
      ...plan,
      recs: plan.recs.map((r) => {
        const why = lines.get(r.slug);
        return why ? { ...r, why } : r;
      }),
    };
  } catch (err) {
    // Visible in Sentry (a misconfigured key in prod), but the user still gets a
    // complete, heuristic-grounded plan — the requirement is never a blank card.
    captureError(err, {
      at: "launchChecker.enrichPublicPlanWhy",
      reason: "public_why_fallback",
    });
    return plan;
  }
}

// ── Plan building (pure) ───────────────────────────────────

/**
 * Rank the catalog for a repo and return a public mini-plan. Ban risk comes
 * straight from the catalog default (no per-user outcome data outside the app),
 * which keeps the public tool honest and never invents a community. Pure and
 * synchronous; the route optionally enriches why-lines afterward.
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

  // GitHub topics are hyphenated ("machine-learning"); normalize to spaces so
  // they match the catalog's keyword→tag map ("machine learning").
  const topicsText = (input.project.topics ?? [])
    .map((t) => t.replace(/-/g, " "))
    .join(" ");

  const scored = matchChannels(
    catalog,
    {
      projectText: `${input.project.name} ${input.project.description ?? ""} ${topicsText} ${input.project.language ?? ""} ${input.project.url ?? ""}`,
      shipText: `${ship.title} ${ship.summary ?? ""}`,
      shipType: ship.type,
    },
    PUBLIC_CANDIDATES,
  );

  // How well do we actually understand this product? Count the strongest
  // PRODUCT-SPECIFIC tag overlap, ignoring the universal signals every technical
  // launch earns. Zero means we're guessing from a bare repo — trigger the honest
  // thin-context path rather than padding with weak matches.
  const matchStrength = scored.reduce(
    (max, s) =>
      Math.max(
        max,
        s.matchedTags.filter((t) => !UNIVERSAL_TAGS.has(t)).length,
      ),
    0,
  );
  const thinContext = matchStrength < PUBLIC_MIN_MATCH_STRENGTH;

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

  let recs: PublicRec[] = ranking.rankings
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
        // Public heuristic why-line: product-name grounded (never a version
        // string), platform-varied. The route may replace revealed ones via LLM.
        why: heuristicWhy(channel.platform, input.project.name, channel.name),
        ruleNote: r.ruleNote,
        ruleHighlight: extractRuleHighlight(channel.rules),
        bestTime: r.bestTime ?? channel.bestTime ?? null,
      } satisfies PublicRec;
    })
    .filter((r): r is PublicRec => r !== null)
    .sort(compareRecs);

  // Thin context: don't pretend. Lead with a couple of safe, broadly useful picks
  // and let the UI surface the "sign up to add a description" note.
  if (thinContext) recs = recs.slice(0, PUBLIC_THIN_RECS);

  return {
    project: {
      name: input.project.name,
      description: input.project.description ?? null,
      url: input.project.url ?? null,
    },
    ship: input.ship ?? null,
    recs,
    totalChannels: catalog.length,
    thinContext,
  };
}
