/**
 * Channel cost — "what does it cost to post/list here?" transparency layer.
 *
 * Some launch venues charge (BetaList went submission-paid; several directories
 * run a free queue plus paid skip/feature tiers). We surface that so a founder
 * can weigh it BEFORE spending — and so the strategist mentions the price in its
 * "why" instead of silently recommending a paid channel.
 *
 * Convention: cost is OPTIONAL on a channel. An absent (or malformed) value
 * normalizes to `{ type: "free" }` — the vast majority of the catalog (Reddit,
 * HN, Discord/Slack, newsletters that curate for free) costs nothing to post to,
 * so "free" is the safe default and only non-free channels carry an explicit
 * entry. Pure + framework-agnostic so the seed, analysis, and the plan card all
 * share one source of truth.
 */

import { z } from "zod";

/**
 * - `free`     — no cost to submit/list/post.
 * - `paid`     — submission requires payment (e.g. BetaList, from $39).
 * - `freemium` — a real free path exists, with optional paid skip/feature tiers.
 *
 * `note` is a short, factual price hint shown in the UI badge + prompt
 * (e.g. "from $39", "free queue; skip-the-line from $29.99"). Keep it grounded
 * in the channel's real pricing — never invented.
 */
export const ChannelCostSchema = z.object({
  type: z.enum(["free", "paid", "freemium"]),
  note: z.string().min(1).max(120).optional(),
});

export type ChannelCost = z.infer<typeof ChannelCostSchema>;
/** Alias used by the seed catalog types (mirrors AccountRequirementsInput). */
export type ChannelCostInput = ChannelCost;

const FREE: ChannelCost = { type: "free" };

/** Normalize a stored/seeded cost value; absent or malformed → free. */
export function parseChannelCost(value: unknown): ChannelCost {
  if (value == null) return FREE;
  const parsed = ChannelCostSchema.safeParse(value);
  return parsed.success ? parsed.data : FREE;
}

export type CostBadge = { label: string; title: string };

/**
 * Small badge for a channel's cost — `null` for free (free channels carry no
 * badge, so the plan stays uncluttered). Paid shows the price inline
 * ("Paid · from $39"); freemium reads "Free + paid" with the detail in the
 * tooltip. Label/title only — the design-system pill styling lives in CSS.
 */
export function costBadge(cost: ChannelCost): CostBadge | null {
  if (cost.type === "paid") {
    return {
      label: cost.note ? `Paid · ${cost.note}` : "Paid",
      title: cost.note ? `Paid submission — ${cost.note}` : "Paid submission",
    };
  }
  if (cost.type === "freemium") {
    return {
      label: "Free + paid",
      title: cost.note
        ? `Free option with paid tiers — ${cost.note}`
        : "Free option with paid tiers",
    };
  }
  return null;
}

/**
 * One-line cost note for the analysis prompt, or `null` when free (free channels
 * are kept out of the prompt to keep it lean). Feeds the strategist the fact so
 * it can state the price in "why" — never to down-rank on cost.
 */
export function costPromptLine(cost: ChannelCost): string | null {
  if (cost.type === "free") return null;
  return cost.note ? `${cost.type} — ${cost.note}` : cost.type;
}
