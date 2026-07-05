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
import type { AccountRequirements } from "./accountReadiness";

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

// ── FAQ (FAQPage schema + on-page section) ─────────────────

export type FaqItem = { question: string; answer: string };

/**
 * Deterministic FAQ for a channel page, composed entirely from seeded catalog
 * data (risk explainer, checklist, best time, account requirements) — the same
 * grounding rule as the rest of the public surface: never an LLM guess.
 * Analysis content, so it stays in English like the risk factors/checklist.
 */
export function channelFaq(
  channel: PublicChannelLike,
  requirements: AccountRequirements | null = null,
): FaqItem[] {
  const risk = explainBanRisk(channel);
  const checklist = postingChecklist(channel);
  const items: FaqItem[] = [];

  items.push({
    question: seoQuestion(channel),
    answer: `${risk.headline}. ${risk.summary}`,
  });

  items.push({
    question: `What gets posts removed on ${channel.name}?`,
    answer: `${risk.factors.join(" ")} In short: ${checklist.donts[0] ?? "don't post an undisclosed promotion."}`,
  });

  if (channel.bestTime) {
    items.push({
      question: `When is the best time to post on ${channel.name}?`,
      answer: `${channel.bestTime}. Timing helps, but fit and format matter more — a rule-breaking post fails at any hour.`,
    });
  }

  const accountQuestion = `Do I need an established account to post on ${channel.name}?`;
  if (requirements) {
    const needs: string[] = [];
    if (requirements.minAccountAgeDays)
      needs.push(`an account at least ${requirements.minAccountAgeDays} days old`);
    if (requirements.minKarmaOrReputation)
      needs.push(
        `${requirements.minKarmaOrReputation.value}+ ${requirements.minKarmaOrReputation.unit}`,
      );
    const gate =
      requirements.level === "required"
        ? `Yes — ${channel.name} gates posting on`
        : `There's no hard rule, but ${channel.name} works best with`;
    const tip = requirements.profileTips?.[0]
      ? ` Tip: ${requirements.profileTips[0]}`
      : "";
    items.push({
      question: accountQuestion,
      answer: needs.length > 0
        ? `${gate} ${needs.join(" and ")}. (Source: ${requirements.sourceNote})${tip}`
        : `${gate} a warmed-up, credible profile. (Source: ${requirements.sourceNote})${tip}`,
    });
  } else {
    items.push({
      question: accountQuestion,
      answer:
        channel.defaultBanRisk === "LOW"
          ? "No formal requirement. A complete profile still helps — people click through to see who's behind the post."
          : "There's no hard gate, but a fresh, empty account posting a launch is the classic removal trigger here. Comment and contribute for a week or two first.",
    });
  }

  return items;
}

// ── Related channels (internal linking) ────────────────────

/**
 * Channels most similar to `channel`, scored by shared tags (weight 2) and
 * same platform (weight 1). Powers the "related channels" block that stitches
 * the 100+ SEO pages together for crawlers and readers alike.
 */
export function relatedChannels(
  channel: PublicChannelLike,
  all: PublicChannelLike[],
  limit = 4,
): PublicChannelLike[] {
  const tags = new Set(channel.tags);
  return all
    .filter((c) => c.slug !== channel.slug)
    .map((c) => ({
      c,
      score:
        c.tags.filter((t) => tags.has(t)).length * 2 +
        (c.platform === channel.platform ? 1 : 0),
    }))
    .filter((x) => x.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        RISK_ORDER[a.c.defaultBanRisk] - RISK_ORDER[b.c.defaultBanRisk] ||
        a.c.name.localeCompare(b.c.name),
    )
    .slice(0, limit)
    .map((x) => x.c);
}

// ── Tag hubs (/channels/for/[tag]) ─────────────────────────

/**
 * Curated hub pages — one per high-intent launch category. Each maps to a real
 * seeded tag and a query founders actually search ("best places to launch a
 * devtool"). Kept curated (not auto-generated from every tag) so every hub has
 * enough channels and a real search audience; copy lives in messages/*.json
 * under `ForTag.hubs.<tag>`.
 */
export const TAG_HUBS = [
  "devtools",
  "saas",
  "ai",
  "opensource",
  "webdev",
  "indie",
  "startup",
  "directory",
  "newsletter",
  "security",
] as const;

export type TagHub = (typeof TAG_HUBS)[number];

export function isTagHub(value: string): value is TagHub {
  return (TAG_HUBS as readonly string[]).includes(value);
}

// ── Comparisons (/channels/compare/[pair]) ─────────────────

/**
 * Curated head-to-head pairs — channels founders genuinely weigh against each
 * other. Curated so every page answers a real query; slugs must exist in the
 * seeded catalog (the test asserts this).
 */
export const COMPARISON_PAIRS: readonly { a: string; b: string }[] = [
  { a: "hn-show", b: "product-hunt" },
  { a: "r-saas", b: "r-startups" },
  { a: "r-sideproject", b: "indie-hackers" },
  { a: "dev-to", b: "hashnode" },
  { a: "hn-show", b: "lobsters" },
  { a: "product-hunt", b: "betalist" },
  { a: "r-webdev", b: "r-programming" },
  { a: "x", b: "linkedin" },
] as const;

export function comparisonSlug(pair: { a: string; b: string }): string {
  return `${pair.a}-vs-${pair.b}`;
}

/** Resolve a URL slug back to its curated pair, or null (404). */
export function parseComparisonSlug(
  slug: string,
): { a: string; b: string } | null {
  return COMPARISON_PAIRS.find((p) => comparisonSlug(p) === slug) ?? null;
}

/**
 * Deterministic one-paragraph verdict for a comparison page, grounded in the
 * two channels' seeded risk levels and audiences. English analysis content.
 */
export function comparisonVerdict(
  a: PublicChannelLike,
  b: PublicChannelLike,
): string {
  const label: Record<BanRiskLevel, string> = {
    LOW: "low",
    MEDIUM: "medium",
    HIGH: "high",
  };
  if (RISK_ORDER[a.defaultBanRisk] !== RISK_ORDER[b.defaultBanRisk]) {
    const [safer, riskier] =
      RISK_ORDER[a.defaultBanRisk] < RISK_ORDER[b.defaultBanRisk]
        ? [a, b]
        : [b, a];
    return `${safer.name} is the safer start (${label[safer.defaultBanRisk]} vs ${label[riskier.defaultBanRisk]} ban risk) — a first launch is unlikely to get pulled if you follow the format. ${riskier.name} can pay off too, but only when your post fits its rules exactly; read them before you press publish.`;
  }
  const aAud = a.audienceDesc ?? "its own community";
  const bAud = b.audienceDesc ?? "its own community";
  return `Both carry ${label[a.defaultBanRisk]} ban risk, so choose by audience: ${a.name} reaches ${aAud}, while ${b.name} reaches ${bAud}. If your product speaks to both, post to each — with a native angle per channel, never the same text twice.`;
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

/** Map a DB row to the pure-helper shape. */
export function toPublicChannelLike(c: Channel): PublicChannelLike {
  return {
    slug: c.slug,
    name: c.name,
    platform: c.platform,
    url: c.url,
    audienceDesc: c.audienceDesc,
    rules: c.rules,
    defaultBanRisk: c.defaultBanRisk as BanRiskLevel,
    bestTime: c.bestTime,
    tags: c.tags,
  };
}

/** Full catalog in pure-helper shape — for related-channel scoring. */
export async function listPublicChannelLikes(): Promise<PublicChannelLike[]> {
  const rows = await db.channel.findMany();
  return rows.map(toPublicChannelLike);
}

/** Channels carrying a tag, safest-first then by name — for hub pages. */
export async function listChannelsByTag(
  tag: string,
): Promise<PublicChannelLike[]> {
  const rows = await db.channel.findMany({ where: { tags: { has: tag } } });
  return rows
    .map(toPublicChannelLike)
    .sort(
      (a, b) =>
        RISK_ORDER[a.defaultBanRisk] - RISK_ORDER[b.defaultBanRisk] ||
        a.name.localeCompare(b.name),
    );
}

/** Both channels of a curated comparison, or null if either is missing. */
export async function getComparisonChannels(
  slug: string,
): Promise<{ a: Channel; b: Channel } | null> {
  const pair = parseComparisonSlug(slug);
  if (!pair) return null;
  const [a, b] = await Promise.all([
    db.channel.findUnique({ where: { slug: pair.a } }),
    db.channel.findUnique({ where: { slug: pair.b } }),
  ]);
  if (!a || !b) return null;
  return { a, b };
}
