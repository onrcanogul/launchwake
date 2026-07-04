/**
 * Launch readiness — the first stage of Launch Mode.
 *
 * A weighted setup checklist scored 0..100. This is deliberately NOT the public
 * Launch Checker (which ranks channels): it measures whether the *product* and
 * the *attribution loop* are ready for a launch, so the launch-day reward
 * (per-channel signups) actually lands. The tracking snippet is the heaviest
 * item because attribution is what makes the whole flow pay off.
 *
 * `computeReadiness` is pure → unit-testable; the async gatherers live in
 * lib/launchMode.ts and feed it real project state.
 */

export type ReadinessInput = {
  /** A tracked click or signup has been observed → the snippet is live. */
  trackingLive: boolean;
  /** Product URL is set (needed for tracked destination links). */
  hasProductUrl: boolean;
  /** A usable product description (drives channel fit). */
  hasDescription: boolean;
  /** A distribution plan has been built for the launch ship. */
  hasPlan: boolean;
  /** How many channels are in the plan. */
  channelCount: number;
  /** How many platform-native drafts are ready. */
  draftCount: number;
  /** A launch-day reminder / schedule has been set. */
  scheduled: boolean;
};

export type ReadinessItem = {
  key: string;
  title: string;
  hint: string;
  weight: number;
  done: boolean;
};

export type ReadinessResult = {
  /** 0..100, the sum of completed item weights (weights total 100). */
  score: number;
  items: ReadinessItem[];
  /** Whether the launch is ready enough to run (score gate). */
  ready: boolean;
};

/** Score gate above which a launch is considered ready to run. */
export const READY_THRESHOLD = 70;

/**
 * Compute the weighted readiness score + checklist. Weights sum to 100; the
 * tracking-snippet item is the single heaviest (attribution powers the reward).
 */
export function computeReadiness(input: ReadinessInput): ReadinessResult {
  const items: ReadinessItem[] = [
    {
      key: "tracking",
      title: "Install the tracking snippet",
      hint: input.trackingLive
        ? "Attribution is live — clicks and signups are being tracked."
        : "The most important step: without it, you can't see which channel drove signups.",
      weight: 34,
      done: input.trackingLive,
    },
    {
      key: "plan",
      title: "Build your distribution plan",
      hint: input.hasPlan
        ? "Channels ranked by fit for your launch."
        : "Rank where to post this launch, safely.",
      weight: 18,
      done: input.hasPlan,
    },
    {
      key: "url",
      title: "Set your product URL",
      hint: input.hasProductUrl
        ? "Tracked links point here."
        : "Needed so tracked links can send people to your product.",
      weight: 12,
      done: input.hasProductUrl,
    },
    {
      key: "channels",
      title: "Pick your launch channels",
      hint:
        input.channelCount > 0
          ? `${input.channelCount} channel${input.channelCount === 1 ? "" : "s"} selected.`
          : "Choose the communities to post to on launch day.",
      weight: 12,
      done: input.channelCount > 0,
    },
    {
      key: "drafts",
      title: "Prepare your launch drafts",
      hint:
        input.draftCount > 0
          ? `${input.draftCount} draft${input.draftCount === 1 ? "" : "s"} ready to copy.`
          : "Platform-native drafts you'll post yourself.",
      weight: 10,
      done: input.draftCount > 0,
    },
    {
      key: "description",
      title: "Describe what you're launching",
      hint: input.hasDescription
        ? "Used to match the right communities."
        : "A sentence or two — it sharpens channel fit.",
      weight: 8,
      done: input.hasDescription,
    },
    {
      key: "schedule",
      title: "Schedule launch day",
      hint: input.scheduled
        ? "Reminders set for the best posting times."
        : "Lock in the date and get a D-1 reminder.",
      weight: 6,
      done: input.scheduled,
    },
  ];

  const score = items.reduce((sum, it) => (it.done ? sum + it.weight : sum), 0);
  return { score, items, ready: score >= READY_THRESHOLD };
}
