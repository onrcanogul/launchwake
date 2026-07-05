/**
 * Account readiness — the "don't launch from a zero-history account" layer.
 *
 * Most launch-channel bans/removals happen because a founder posts a big launch
 * from a fresh account with no karma, no bio, and no posting history. This module
 * turns each channel's `accountRequirements` (seeded, grounded in real rules) plus
 * a known launch date into a per-channel readiness block: requirement badges,
 * profile tips, a lead-time hint, and — when the launch is too soon to prepare a
 * credible account — an at-risk warning + a small fit-score penalty so ranking
 * nudges toward lower-barrier venues.
 *
 * Golden rule: this only ADVISES the human. LaunchWake never inspects, creates,
 * or posts from anyone's account — so a requirement can only ever be "at-risk"
 * (structurally impossible to prepare in time) or "unknown"/"met" (the timeline
 * allows it; we can't verify the account itself). Pure + framework-agnostic so it
 * is trivially unit-testable and shared by the plan page, analysis, and the
 * readiness checklist.
 */

import { z } from "zod";

// ── Catalog contract ───────────────────────────────────────
/**
 * Per-channel account requirements, seeded alongside the catalog. `sourceNote`
 * anchors every value to a real rule/guideline so we never invent a threshold;
 * where a channel has no formal gate, `level` is "recommended", not "required".
 */
export const AccountRequirementsSchema = z
  .object({
    /**
     * "required" = the channel formally gates posting on this; "recommended" =
     * no hard rule, but posting from a fresh account here is risky. Defaults to
     * the safer, non-overstated "recommended".
     */
    level: z.enum(["required", "recommended"]).default("recommended"),
    /** Minimum account age in days before the account reads as credible here. */
    minAccountAgeDays: z.number().int().positive().optional(),
    /** Minimum karma/reputation/followers, with the channel's own unit label. */
    minKarmaOrReputation: z
      .object({
        value: z.number().int().nonnegative(),
        unit: z.string().min(1), // "karma", "combined karma", "followers", "reputation"
      })
      .optional(),
    /** Short, actionable prep tips ("fill out your bio", "comment for a week"). */
    profileTips: z.array(z.string().min(1)).optional(),
    /** Which rule/community guideline these values come from. */
    sourceNote: z.string().min(1),
  })
  .strict();

/** Authoring-side type (level optional — the schema fills the default). */
export type AccountRequirementsInput = z.input<typeof AccountRequirementsSchema>;
/** Parsed/normalized type (level always present). */
export type AccountRequirements = z.infer<typeof AccountRequirementsSchema>;

/**
 * Safely coerce a stored JSON value (Prisma `Json?`) into typed requirements.
 * Returns null for null/missing/malformed data so callers can `?? null` freely.
 */
export function parseAccountRequirements(value: unknown): AccountRequirements | null {
  if (value == null) return null;
  const parsed = AccountRequirementsSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

// ── Tunables ───────────────────────────────────────────────
const MS_PER_DAY = 86_400_000;

/**
 * Recommended warm-up window when a channel wants karma/reputation before you
 * post — grounded in the common "comment genuinely for 1–2 weeks first" advice.
 * Used as the lead time when there's no explicit account-age threshold.
 */
export const KARMA_WARMUP_DAYS = 14;

/**
 * Fit-score penalty applied in launch-mode ranking when a channel is at-risk
 * (the launch is too soon to prepare a credible account). Kept small so it
 * nudges ordering toward safer venues without burying an otherwise-great fit.
 */
export const AT_RISK_PENALTY: Record<AccountRequirements["level"], number> = {
  required: 8,
  recommended: 4,
};

// ── Output contract ────────────────────────────────────────
export type RequirementStatus =
  /** The launch timeline allows meeting this before launch day. */
  | "met"
  /** No launch date set yet — timing can't be assessed. */
  | "unknown"
  /** The launch is too soon to satisfy this from a fresh account. */
  | "at-risk";

export type RequirementBadge = {
  key: "age" | "karma";
  /** Compact label, e.g. "30-day-old account", "100+ combined karma". */
  label: string;
  status: RequirementStatus;
  /** One-line explanation of why this matters here. */
  detail: string;
};

export type AccountReadinessBlock = {
  level: AccountRequirements["level"];
  badges: RequirementBadge[];
  tips: string[];
  sourceNote: string;
  /** Recommended days-before-launch to start preparing the account (0 = none). */
  leadTimeDays: number;
  /** "Create this account at least N weeks before launch." Null when leadTime = 0. */
  leadTimeHint: string | null;
  /** True only when a launch date is set AND the lead time can't be met. */
  atRisk: boolean;
  /** Ban-safety warning copy, present only when `atRisk`. */
  warning: string | null;
  /** Fit-score penalty for launch-mode ranking (0 unless `atRisk`). */
  fitPenalty: number;
};

export type ReadinessOptions = {
  /** The chosen launch date, or null/undefined if not scheduled yet. */
  launchAt?: Date | null;
  /** "Now" — injected so the computation stays pure and testable. */
  now: Date;
  /** Channel name, woven into the warning copy when provided. */
  channelName?: string;
};

/**
 * Summary chip for a readiness block — a short label + status key shared by the
 * plan-card row and the readiness checklist so both read consistently. Pure/UI-
 * agnostic: the label is text, the class is a status token the UI maps to color.
 */
export function readinessChip(
  block: AccountReadinessBlock,
): { label: string; cls: "at-risk" | "met" | "info" } {
  if (block.atRisk) return { label: "At risk", cls: "at-risk" };
  if (block.badges.length > 0 && block.badges.every((b) => b.status === "met")) {
    return { label: "On track", cls: "met" };
  }
  return {
    label: block.level === "required" ? "Required" : "Recommended",
    cls: "info",
  };
}

/** Whole days from `now` until `launchAt`, or null when no valid date is set. */
export function daysUntilLaunch(launchAt: Date | null | undefined, now: Date): number | null {
  if (!(launchAt instanceof Date) || Number.isNaN(launchAt.getTime())) return null;
  return Math.floor((launchAt.getTime() - now.getTime()) / MS_PER_DAY);
}

/**
 * Turn a channel's requirements + the launch timeline into a readiness block.
 * Returns null when the channel has no requirements (nothing to advise).
 */
export function computeAccountReadiness(
  reqs: AccountRequirements | null,
  opts: ReadinessOptions,
): AccountReadinessBlock | null {
  if (!reqs) return null;

  const days = daysUntilLaunch(opts.launchAt, opts.now);

  // The account-age threshold and the karma warm-up both define how early you
  // must start; the governing lead time is the larger of the two.
  const karmaWarmup = reqs.minKarmaOrReputation ? KARMA_WARMUP_DAYS : 0;
  const leadTimeDays = Math.max(reqs.minAccountAgeDays ?? 0, karmaWarmup);

  const statusFor = (thresholdDays: number): RequirementStatus => {
    if (days === null) return "unknown";
    return days >= thresholdDays ? "met" : "at-risk";
  };

  const badges: RequirementBadge[] = [];
  if (reqs.minAccountAgeDays) {
    badges.push({
      key: "age",
      label: `${reqs.minAccountAgeDays}-day-old account`,
      status: statusFor(reqs.minAccountAgeDays),
      detail: `Accounts younger than ~${reqs.minAccountAgeDays} days draw extra scrutiny or automatic filtering here.`,
    });
  }
  if (reqs.minKarmaOrReputation) {
    const { value, unit } = reqs.minKarmaOrReputation;
    badges.push({
      key: "karma",
      label: `${value}+ ${unit}`,
      status: statusFor(karmaWarmup),
      detail: `Build up ${unit} with genuine activity first — plan ~${KARMA_WARMUP_DAYS} days of warm-up before you post.`,
    });
  }

  // At-risk only makes sense once a date exists and there's real lead time to miss.
  const atRisk = days !== null && leadTimeDays > 0 && days < leadTimeDays;

  const weeks = Math.max(1, Math.ceil(leadTimeDays / 7));
  const leadTimeHint =
    leadTimeDays > 0
      ? `Create${reqs.minKarmaOrReputation ? " and warm up" : ""} this account at least ${weeks} week${weeks === 1 ? "" : "s"} before launch.`
      : null;

  const who = opts.channelName ?? "this channel";
  const timing =
    days !== null && days <= 0
      ? "your launch date has arrived"
      : `it's only ${days} day${days === 1 ? "" : "s"} away`;
  const warning = atRisk
    ? `Your account may be too new for ${who} — ${timing}, short of the ~${leadTimeDays}-day runway. Posting a launch from a fresh account here raises ban/removal risk; consider a lower-barrier venue (a "Show" thread or your own blog) or start this account today.`
    : null;

  return {
    level: reqs.level,
    badges,
    tips: reqs.profileTips ?? [],
    sourceNote: reqs.sourceNote,
    leadTimeDays,
    leadTimeHint,
    atRisk,
    warning,
    fitPenalty: atRisk ? AT_RISK_PENALTY[reqs.level] : 0,
  };
}
