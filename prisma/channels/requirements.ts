import type { AccountRequirementsInput } from "../../lib/accountReadiness";

/**
 * Reusable account-requirement presets for the catalog.
 *
 * Every value here is grounded in a real, publicly-stated norm and marked
 * "recommended" unless the channel enforces a formal, published gate. We never
 * invent hard thresholds: where a community has no numeric rule, these encode
 * the widely-documented "don't post from a zero-history account" guidance and
 * say so in `sourceNote`. Keep this honest — a wrong number gets a founder banned.
 */

/**
 * General Reddit self-promotion readiness. Most programming/startup subreddits
 * run AutoModerator filters that remove posts from very new or low-karma
 * accounts; the exact numbers are per-sub and usually unpublished, so these are
 * conservative *recommended* baselines, not a specific subreddit's rule.
 */
export function redditReadiness(
  overrides?: Partial<{
    minAccountAgeDays: number;
    minKarma: number;
    extraTips: string[];
  }>,
): AccountRequirementsInput {
  return {
    level: "recommended",
    minAccountAgeDays: overrides?.minAccountAgeDays ?? 30,
    minKarmaOrReputation: { value: overrides?.minKarma ?? 100, unit: "combined karma" },
    profileTips: [
      "Post from a real, established account — not one made for this launch.",
      "Comment genuinely in the subreddit for 1–2 weeks before you post.",
      "Read the sidebar/wiki rules; many subs funnel promo into a weekly thread.",
      ...(overrides?.extraTips ?? []),
    ],
    sourceNote:
      "General Reddit self-promotion norms — many programming/startup subreddits' AutoModerator removes posts from new or low-karma accounts; exact thresholds vary by subreddit, so check its rules.",
  };
}

/** Hacker News — no karma gate to submit, but green (new) usernames get scrutiny. */
export const HN_SHOW_READINESS: AccountRequirementsInput = {
  level: "recommended",
  minAccountAgeDays: 14,
  profileTips: [
    "Add a real name and an 'about' that says what you're building.",
    "Comment on other threads for a week or two so you're not a zero-history 'green' account.",
    "Line up honest early testers — never organize upvotes; vote rings get flagged.",
  ],
  sourceNote:
    "Hacker News guidelines & FAQ — there's no karma requirement to submit, but new ('green') accounts draw more scrutiny and voting rings are penalized.",
};

/** HN link submissions — same spirit as Show HN, lighter (no artifact to defend). */
export const HN_READINESS: AccountRequirementsInput = {
  level: "recommended",
  minAccountAgeDays: 14,
  profileTips: [
    "Submit from an account with some genuine comment history, not a fresh one.",
    "Add an 'about' with your real identity — it reads as less spammy.",
  ],
  sourceNote:
    "Hacker News FAQ — no karma gate to submit links, but brand-new accounts and self-promotion patterns attract flags.",
};

/** Product Hunt — complete maker profile + a little follower warm-up before launch day. */
export const PRODUCT_HUNT_READINESS: AccountRequirementsInput = {
  level: "recommended",
  minAccountAgeDays: 14,
  minKarmaOrReputation: { value: 30, unit: "followers" },
  profileTips: [
    "Complete your maker profile: avatar, bio, links, and any past projects.",
    "Follow and engage on Product Hunt for a couple of weeks so you have some followers before launch day.",
    "Prepare your gallery assets and first comment (the maker story) in advance.",
    "Never buy or solicit upvotes — it's grounds for removal.",
  ],
  sourceNote:
    "Product Hunt maker guidance — no follower gate to launch, but a complete profile and an existing following materially improve launch-day reach; vote manipulation is bannable.",
};

/** Indie Hackers — value-first community, no gate; a real profile is what matters. */
export const INDIE_HACKERS_READINESS: AccountRequirementsInput = {
  level: "recommended",
  profileTips: [
    "Fill out your profile with your real name, product, and a link.",
    "Share a couple of comments or a 'building' post before your launch post so you're a familiar face.",
  ],
  sourceNote:
    "Indie Hackers norms — no formal account requirement; transparency and prior participation are rewarded, pure promotion is ignored.",
};
