/**
 * Public channel catalog — the read layer behind the login-less "Ban Risk
 * Lookup" SEO pages (/channels, /channels/[slug]).
 *
 * The explainer/checklist helpers are PURE and grounded in the seeded catalog +
 * platform norms (the same knowledge the ban-safety linter uses) — never an LLM
 * guess — so the pages are trustworthy and can be statically rendered. DB
 * fetchers are thin wrappers on top.
 */

import { db } from "./db";
import type { BanRisk, Channel, Platform } from "@prisma/client";

export type BanRiskLevel = "LOW" | "MEDIUM" | "HIGH";

/** Structural subset used by the pure helpers — keeps them DB-free/testable. */
export type PublicChannelLike = {
  slug: string;
  name: string;
  platform: string;
  url?: string | null;
  audienceDesc?: string | null;
  rules?: string | null;
  defaultBanRisk: BanRiskLevel;
  bestTime?: string | null;
  tags: string[];
};

const RISK_ORDER: Record<BanRiskLevel, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 };

// ── Ban-risk explainer ─────────────────────────────────────

export type RiskExplainer = {
  level: BanRiskLevel;
  headline: string;
  /** One-paragraph plain-English summary. */
  summary: string;
  /** Concrete reasons this channel carries the risk it does. */
  factors: string[];
};

const RISK_HEADLINE: Record<BanRiskLevel, string> = {
  LOW: "Low ban risk",
  MEDIUM: "Medium ban risk",
  HIGH: "High ban risk",
};

const RISK_SUMMARY: Record<BanRiskLevel, string> = {
  LOW: "You can share here directly, provided you follow the format. Posts are rarely removed when they lead with substance instead of a pitch.",
  MEDIUM: "Self-promotion is tolerated but policed. Frame the post as a lesson or a genuine contribution and the tool as context, or it may be removed.",
  HIGH: "Direct promotion is routinely removed and can hurt your account standing. Only post something that stands on its own; a pitch will get pulled fast.",
};

/**
 * Explain a channel's ban risk from its catalog risk level and rule text.
 * Deterministic: the factors are keyword-derived, so the page reads the same
 * every render and matches what the in-app linter enforces.
 */
export function explainBanRisk(channel: PublicChannelLike): RiskExplainer {
  const level = channel.defaultBanRisk;
  const rules = (channel.rules ?? "").toLowerCase();
  const factors: string[] = [];

  if (/90\/10/.test(rules))
    factors.push("Enforces a ~90/10 rule — 9 value posts for every 1 that promotes.");
  if (/heavily moderated|tightly moderated|quickly removed|often removed|removed/.test(rules))
    factors.push("Actively moderated; off-guideline posts are removed fast.");
  if (/no (product )?promotion|no marketing|self-promo/.test(rules))
    factors.push("Explicit limits on self-promotion and marketing language.");
  if (/weekly (thread|threads)|share your startup|showoff saturday|weekly threads/.test(rules))
    factors.push("Promotion is confined to a dedicated weekly/scheduled thread.");
  if (/no link|links? in (the )?title|link-in-title/.test(rules))
    factors.push("Links in the title (or post body) trigger removal — keep them out.");
  if (/first comment/.test(rules))
    factors.push("Outbound links belong in the first comment, not the post.");
  if (/invite-only|invite only/.test(rules))
    factors.push("Invite-only and high-signal — marketing is unwelcome by design.");
  if (/transparen|disclose|be upfront/.test(rules))
    factors.push("Rewards transparency; disclose that it's your project.");

  if (factors.length === 0) {
    factors.push(
      level === "LOW"
        ? "Built for sharing what you made — no promo-specific restrictions beyond the format."
        : "Community norms discourage undisclosed promotion; contribute value first.",
    );
  }

  return { level, headline: RISK_HEADLINE[level], summary: RISK_SUMMARY[level], factors };
}

// ── Safe-posting checklist ─────────────────────────────────

export type PostingChecklist = { dos: string[]; donts: string[] };

const PLATFORM_TIPS: Record<string, PostingChecklist> = {
  HACKERNEWS: {
    dos: [
      "Lead with what it is and the problem it solves, in plain language.",
      "Use the 'Show HN:' title format when it's something people can try.",
      "Reply to every comment quickly — engagement is the whole game.",
    ],
    donts: [
      "Don't use hype adjectives ('revolutionary', 'game-changing').",
      "Don't post a pitch; post a build story or a substantive writeup.",
    ],
  },
  REDDIT: {
    dos: [
      "Frame the post as a lesson, guide, or question — value first.",
      "Read the subreddit rules and respect any self-promo ratio or thread.",
      "Engage in the comments; mention your tool only as context.",
    ],
    donts: [
      "Don't put a link in the title.",
      "Don't drop a bare product pitch outside the designated thread.",
    ],
  },
  PRODUCTHUNT: {
    dos: [
      "Prepare the gallery, tagline, and maker's first comment in advance.",
      "Go live at 00:01 PT and rally your network early in the day.",
    ],
    donts: [
      "Don't buy or solicit upvotes — it's grounds for removal.",
      "Don't launch without assets ready; the 24h window is unforgiving.",
    ],
  },
  INDIEHACKERS: {
    dos: [
      "Share real numbers — revenue, users, what worked and what didn't.",
      "Be transparent about being the maker; the community rewards it.",
    ],
    donts: ["Don't post pure promotion; it gets ignored."],
  },
  DEVTO: {
    dos: [
      "Publish a genuine technical article — a tutorial, walkthrough, or retro.",
      "Tag it correctly (#webdev, #node) and canonical-link your own blog.",
    ],
    donts: ["Don't make the article a thin wrapper around a product pitch."],
  },
  LOBSTERS: {
    dos: [
      "Only submit deep technical content, tagged correctly.",
      "Disclose authorship if you're linking your own work.",
    ],
    donts: ["Don't include any marketing language whatsoever."],
  },
  X: {
    dos: [
      "Open with a hook; put the link last or in a reply.",
      "Use a thread for features and reply fast to keep reach up.",
    ],
    donts: ["Don't lead with the link — it can suppress reach."],
  },
  LINKEDIN: {
    dos: [
      "Put the outbound link in the first comment, not the post.",
      "Lead with a professional/business-value angle.",
    ],
    donts: ["Don't include an outbound link in the post body — it throttles reach."],
  },
  DISCORD: {
    dos: [
      "Post only in the dedicated #showcase / #i-made-this / self-promo channel.",
      "Share what you built as a person, and stick around to answer questions.",
    ],
    donts: [
      "Don't drop product links in help, support, or general channels — that's spam.",
      "Don't cold-DM members or ping @everyone.",
    ],
  },
  SLACK: {
    dos: [
      "Use the community's self-promo / show-and-tell channel if one exists.",
      "Contribute genuinely first; let a helpful profile earn the audience.",
    ],
    donts: [
      "Don't broadcast a pitch to general channels or DM members cold.",
      "Don't post if the community has no promo channel — it reads as spam.",
    ],
  },
  NEWSLETTER: {
    dos: [
      "Submit through the newsletter's official link/tool form where one exists.",
      "Lead with a genuinely useful article, release, or tool — not ad copy.",
    ],
    donts: [
      "Don't send a marketing pitch to the editor; give them something worth curating.",
      "Don't expect placement without being newsworthy — most are editor-curated.",
    ],
  },
  DIRECTORY: {
    dos: [
      "Complete the listing fully: clear tagline, screenshots, categories, links.",
      "Follow the queue or launch-day rules; verify your domain when asked.",
    ],
    donts: [
      "Don't submit a thin or duplicate listing — many are moderator-reviewed.",
      "Don't buy fake votes or reviews; it gets listings removed.",
    ],
  },
  MASTODON: {
    dos: [
      "Post as a real person and share the launch conversationally with context.",
      "Use relevant hashtags sparingly and reply to engage.",
    ],
    donts: [
      "Don't drive-by drop a bare link or stuff hashtags — instances flag it as spam.",
      "Don't run a brand/company account on instances that require personal accounts.",
    ],
  },
  BLUESKY: {
    dos: [
      "Mix build-in-public updates and real replies with your launch post.",
      "Post into relevant custom feeds and threads, not just your timeline.",
    ],
    donts: ["Don't post a bare promo with no engagement — it underperforms."],
  },
  FORUM: {
    dos: [
      "Frame the post around a genuine discussion, question, or the craft story.",
      "Disclose that it's your product and participate in the comments.",
    ],
    donts: [
      "Don't open a thread that's purely a launch pitch — many forums ban liberally.",
    ],
  },
  BLOG: {
    dos: [
      "Publish a real, useful article; keep any product mention to one CTA at the end.",
      "Canonical-link to your own blog and disclose affiliation.",
    ],
    donts: [
      "Don't make the post a thin wrapper around a sales pitch — editors reject it.",
    ],
  },
  OTHER: {
    dos: ["Follow the community's stated norms and lead with value."],
    donts: ["Don't post an undisclosed or link-heavy promotion."],
  },
};

/** Do/don't checklist for posting safely, keyed by platform. */
export function postingChecklist(channel: PublicChannelLike): PostingChecklist {
  return PLATFORM_TIPS[channel.platform] ?? PLATFORM_TIPS.OTHER;
}

/** SEO question this page answers, e.g. "Can I post my startup on r/SaaS?". */
export function seoQuestion(channel: PublicChannelLike): string {
  return `Can I post my startup on ${channel.name}?`;
}

// ── DB fetchers ────────────────────────────────────────────

export type PublicChannelRow = {
  slug: string;
  name: string;
  platform: Platform;
  audienceDesc: string | null;
  banRisk: BanRisk;
  bestTime: string | null;
};

/** All channels for the public directory, ordered safest-first then by name. */
export async function listPublicChannels(): Promise<PublicChannelRow[]> {
  const catalog = await db.channel.findMany();
  return catalog
    .map((c) => ({
      slug: c.slug,
      name: c.name,
      platform: c.platform,
      audienceDesc: c.audienceDesc,
      banRisk: c.defaultBanRisk,
      bestTime: c.bestTime,
    }))
    .sort(
      (a, b) =>
        RISK_ORDER[a.banRisk] - RISK_ORDER[b.banRisk] ||
        a.name.localeCompare(b.name),
    );
}

/** All slugs — for generateStaticParams. */
export async function listPublicChannelSlugs(): Promise<string[]> {
  const rows = await db.channel.findMany({ select: { slug: true } });
  return rows.map((r) => r.slug);
}

/** A single channel by slug, or null. */
export async function getPublicChannel(slug: string): Promise<Channel | null> {
  return db.channel.findUnique({ where: { slug } });
}
