/**
 * Demo data — the single source of truth for the public, login-less product tour
 * at `/demo` (and the landing "See a sample report" modal). It's fixed, coherent
 * mock data for one example product, **Cascade** (an open-source database-migration
 * tool), shaped to the exact view-model types the real app pages consume so the
 * `/demo` tree can render the real components with zero divergence.
 *
 * Everything here is a plain constant: no DB, no session, no LLM, no network. Types
 * are imported with `import type` so this module never pulls `lib/db` (which those
 * modules import) into a client or public bundle. Keeping it in `/lib` (not a
 * component) honors the "business data is framework-agnostic + unit-testable" rule;
 * `lib/demoData.test.ts` asserts the numbers reconcile.
 */

import type { RecView, ShipKit } from "./plans";
import type { ResultsRollup, SelfReportView } from "./attribution";

// ── The example product ────────────────────────────────────
export const DEMO_PROJECT = {
  name: "Cascade",
  subtitle: "Open-source database migrations that never lock a table",
} as const;

export const DEMO_SHIP = {
  id: "demo-ship",
  type: "LAUNCH" as const,
  title: "Cascade 1.0",
  summary: "First public release — online schema changes with zero exclusive locks.",
} as const;

export const DEMO_USER = { name: "Guest", plan: "FREE" as const };

/** Total channels in the catalog — for the "ranked from N" copy. */
export const DEMO_CHANNEL_TOTAL = 40;

// ── Where to post: the ranked plan (RecView[]) ─────────────
const FREE = { type: "free" } as const;

export const DEMO_RECS: RecView[] = [
  {
    id: "rec-hn",
    channelSlug: "hn-show",
    channelName: "Hacker News — Show HN",
    platform: "HACKERNEWS",
    audienceDesc: "~5M developers & founders · very high intent",
    fitScore: 92,
    banRisk: "LOW",
    bestTime: "Tue–Thu, 8am ET",
    whyText:
      "Cascade is exactly the try-it-now technical tool Show HN rewards. Lead with the problem — a migration locking a table in prod — and the build story, never a pitch.",
    ruleNote: "No link in the title",
    outcomeNote: "Show HN median for dev-tools: 34 signups",
    hasDraft: true,
    shortform: false,
    accountRequirements: null,
    cost: FREE,
  },
  {
    id: "rec-ph",
    channelSlug: "product-hunt",
    channelName: "Product Hunt",
    platform: "PRODUCTHUNT",
    audienceDesc: "Makers & early adopters browsing for new tools",
    fitScore: 88,
    banRisk: "LOW",
    bestTime: "Tue, 12:01am PT",
    whyText:
      "List Cascade with a crisp tagline and a 20-second demo GIF. The makers here try things immediately and leave real, useful feedback on day one.",
    ruleNote: "Launch at 12:01am PT",
    outcomeNote: null,
    hasDraft: true,
    shortform: false,
    accountRequirements: null,
    cost: FREE,
  },
  {
    id: "rec-devops",
    channelSlug: "r-devops",
    channelName: "r/devops",
    platform: "REDDIT",
    audienceDesc: "~520k platform & ops engineers",
    fitScore: 85,
    banRisk: "MEDIUM",
    bestTime: "Weekdays, 9–11am ET",
    whyText:
      "This sub feels Cascade's pain weekly. Post the failure story — a locked table during a deploy — not the product; anything that reads as an ad gets removed.",
    ruleNote: "Self-promo only in the weekly thread",
    outcomeNote: null,
    hasDraft: true,
    shortform: false,
    accountRequirements: null,
    cost: FREE,
  },
  {
    id: "rec-lobsters",
    channelSlug: "lobsters",
    channelName: "Lobsters",
    platform: "LOBSTERS",
    audienceDesc: "Small, high-signal engineering community",
    fitScore: 80,
    banRisk: "MEDIUM",
    bestTime: "Weekdays",
    whyText:
      "Cascade's zero-lock approach is a genuine technical angle Lobsters will debate. Submit the design write-up, tag it correctly, and stay for the thread.",
    ruleNote: "Invite-only · needs a real technical angle",
    outcomeNote: null,
    hasDraft: true,
    shortform: false,
    accountRequirements: null,
    cost: FREE,
  },
  {
    id: "rec-tiktok",
    channelSlug: "tiktok-build-in-public",
    channelName: "TikTok — Build in public",
    platform: "TIKTOK",
    audienceDesc: "Short-form · founders & curious devs",
    fitScore: 74,
    banRisk: "LOW",
    bestTime: "Weekdays, 6–9pm",
    whyText:
      "Show it, don't tell it: a 2-second hook — 'watch a migration lock a table… then not' — over a screen recording. Keep your one tracked link in bio; posts can't hold a clickable link.",
    ruleNote: "Link in bio only",
    outcomeNote: null,
    hasDraft: true,
    shortform: true,
    accountRequirements: null,
    cost: FREE,
  },
];

// ── The launch kit: a draft per channel (ShipKit) ──────────
const HN_DRAFT_BODY = `I kept taking production downtime whenever a migration rewrote a big table, so I built Cascade. It runs schema changes in the background and swaps them in without an exclusive lock — even on tables with millions of rows.

It's open-source (MIT), works with Postgres and MySQL, and installs as a single binary. Happy to answer anything about how the online swap works.`;

export const DEMO_KIT: ShipKit = {
  ship: { id: DEMO_SHIP.id, title: DEMO_SHIP.title },
  recs: [
    {
      id: "rec-hn",
      channelSlug: "hn-show",
      channelName: "Hacker News — Show HN",
      platform: "HACKERNEWS",
      ruleNote: "No link in the title",
      channelRules:
        "Lead with the build story. Put the link in the first comment, not the title. Stay to answer questions in the first hour.",
      bestTime: "Tue–Thu, 8am ET",
      shortform: false,
      draft: {
        body: `Show HN: Cascade – database migrations that never lock a table\n\n${HN_DRAFT_BODY}`,
        safetyNote:
          "No link in the title. Post the GitHub link as your first comment, then reply to questions for the first hour — that's what carries a Show HN to the front page without tripping the self-promo filter.",
        storyboard: null,
      },
      post: null,
    },
    {
      id: "rec-ph",
      channelSlug: "product-hunt",
      channelName: "Product Hunt",
      platform: "PRODUCTHUNT",
      ruleNote: "Launch at 12:01am PT",
      channelRules:
        "Ship at 12:01am PT. Line up a hunter and a few early comments. Reply to every comment on day one.",
      bestTime: "Tue, 12:01am PT",
      shortform: false,
      draft: {
        body: `Cascade — open-source database migrations that never lock a table.\n\nRun schema changes in the background and swap them in with zero exclusive locks, even on huge tables. Postgres + MySQL, MIT-licensed, single binary. I'll be here all day answering questions.`,
        safetyNote:
          "Don't ask for upvotes anywhere — Product Hunt shadow-ranks that. Share the page and let the demo GIF do the work.",
        storyboard: null,
      },
      post: null,
    },
    {
      id: "rec-devops",
      channelSlug: "r-devops",
      channelName: "r/devops",
      platform: "REDDIT",
      ruleNote: "Self-promo only in the weekly thread",
      channelRules:
        "No standalone promo posts. Share in the weekly 'what are you working on' thread, and lead with the problem, not the product.",
      bestTime: "Weekdays, 9–11am ET",
      shortform: false,
      draft: {
        body: `A migration locked a 40M-row table during a deploy last month and took us down for 9 minutes. I've been chasing zero-lock schema changes since. Wrote up the approach (background copy + atomic swap) and open-sourced the tool — happy to compare notes on how other teams handle big migrations.`,
        safetyNote:
          "Post this in the weekly self-promo thread only. A standalone link post here will be removed and can cost you the account.",
        storyboard: null,
      },
      post: null,
    },
    {
      id: "rec-lobsters",
      channelSlug: "lobsters",
      channelName: "Lobsters",
      platform: "LOBSTERS",
      ruleNote: "Invite-only · needs a real technical angle",
      channelRules:
        "Submit the technical write-up (not the landing page), tag it correctly, and engage in the comments.",
      bestTime: "Weekdays",
      shortform: false,
      draft: {
        body: `How Cascade does online schema changes without an exclusive lock — a write-up of the background-copy + shadow-table + atomic-rename approach, the edge cases (triggers, foreign keys, huge tables), and where it still falls short.`,
        safetyNote:
          "Submit the design write-up, not the product page. Tag it 'databases' and stay for the discussion.",
        storyboard: null,
      },
      post: null,
    },
    {
      id: "rec-tiktok",
      channelSlug: "tiktok-build-in-public",
      channelName: "TikTok — Build in public",
      platform: "TIKTOK",
      ruleNote: "Link in bio only",
      channelRules:
        "Hook in the first 2 seconds. No clickable link in the post — put your one tracked link in bio.",
      bestTime: "Weekdays, 6–9pm",
      shortform: true,
      draft: {
        body: "Watch a migration lock a table in production — then watch Cascade do the same change with zero downtime. Build-in-public, day 1 of launch.",
        safetyNote:
          "Posts can't hold a clickable link — keep your one tracked link in bio and point to it verbally.",
        storyboard: {
          hook: "Text on screen: 'watch a migration lock a prod table' over a terminal.",
          beats: [
            { label: "0–2s hook", detail: "Terminal runs a normal ALTER TABLE; a 'locked / requests piling up' meter spikes red." },
            { label: "2–6s problem", detail: "Cut to a dashboard showing 9 minutes of downtime — 'this took us down last month.'" },
            { label: "6–12s fix", detail: "Run the same change with Cascade; the meter stays green, traffic keeps flowing." },
            { label: "12–15s CTA", detail: "'Open-source, link in bio.' Show the repo name." },
          ],
          onScreenText: [
            "normal migration = locked table",
            "9 min of downtime",
            "same change, zero locks",
            "open-source · link in bio",
          ],
          sound: "A trending 'before vs after' reveal sound.",
        },
      },
      post: null,
    },
  ],
};

// ── Results: attribution rollup (ResultsRollup) ────────────
const CH = (
  channelName: string,
  clicks: number,
  signups: number,
  revenueCents: number,
  recurringCents = 0,
) => ({
  channelName,
  posts: 1,
  clicks,
  signups,
  conversion: clicks > 0 ? signups / clicks : 0,
  revenueCents,
  verifiedRevenueCents: revenueCents,
  recurringCents,
});

const PERCHANNEL = [
  CH("Hacker News — Show HN", 520, 18, 18000, 6000),
  CH("Product Hunt", 340, 11, 7200, 3000),
  CH("r/devops", 210, 6, 3600),
  CH("Lobsters", 96, 3, 2400),
  CH("TikTok — Build in public", 118, 3, 0),
];

const POST = (
  postId: string,
  channelName: string,
  postUrl: string,
  clicks: number,
  signups: number,
  revenueCents: number,
  recurringCents = 0,
) => ({
  postId,
  channelName,
  shipTitle: DEMO_SHIP.title,
  trackedUrl: `https://lw.to/${postId}`,
  postUrl,
  clicks,
  signups,
  conversion: clicks > 0 ? signups / clicks : 0,
  revenueCents,
  verifiedRevenueCents: revenueCents,
  recurringCents,
  removed: false,
  coaching: null,
});

export const DEMO_RESULTS: ResultsRollup = {
  perPost: [
    POST("p-hn", "Hacker News — Show HN", "https://news.ycombinator.com/item?id=demo", 520, 18, 18000, 6000),
    POST("p-ph", "Product Hunt", "https://www.producthunt.com/products/cascade", 340, 11, 7200, 3000),
    POST("p-devops", "r/devops", "https://reddit.com/r/devops/comments/demo", 210, 6, 3600),
    POST("p-lobsters", "Lobsters", "https://lobste.rs/s/demo", 96, 3, 2400),
    POST("p-tiktok", "TikTok — Build in public", "https://tiktok.com/@cascade/video/demo", 118, 3, 0),
  ],
  perChannel: PERCHANNEL,
  totalClicks: 1284,
  totalSignups: 41,
  unattributedSignups: 6,
  conversion: 41 / 1284,
  totalRevenueCents: 31200,
  totalVerifiedRevenueCents: 31200,
  mrrCents: 9000,
  currency: "usd",
  bestChannel: "Hacker News — Show HN",
  topRevenueChannel: { name: "Hacker News — Show HN", revenueCents: 18000 },
  roi: {
    posts: 5,
    effortMinutes: 90,
    effortLabel: "1h 30m",
    clicks: 1284,
    signups: 41,
    revenueCents: 31200,
    recurringCents: 9000,
    currency: "usd",
  },
  insight:
    "Show HN drove 44% of your signups and more than half your revenue. Your next launch should lead there.",
};

// ── Dark-social / self-report reconciliation (SelfReportView) ─
export const DEMO_SELF_REPORT: SelfReportView = {
  total: 14,
  bySource: [
    { source: "twitter", label: "X / Twitter", count: 5, share: 5 / 14 },
    { source: "friend", label: "A friend or colleague", count: 4, share: 4 / 14 },
    { source: "hackernews", label: "Hacker News", count: 3, share: 3 / 14 },
    { source: "search", label: "Search / Google", count: 2, share: 2 / 14 },
  ],
  darkSocialCount: 8,
  darkSocialShare: 8 / 14,
  topDarkSource: { source: "twitter", label: "X / Twitter", count: 4, share: 0.5 },
  trackedCount: 6,
  reconciledCount: 4,
  agreeCount: 3,
  disagreeCount: 1,
  divergenceShare: 0.25,
  insight:
    "1 in 4 tracked signups named a different channel than their link — your word-of-mouth is bigger than UTMs show.",
  lastAt: new Date("2026-06-28T12:00:00Z"),
};

// ── Channels directory rows ────────────────────────────────
export type DemoChannelRow = {
  name: string;
  platform: string;
  audience: string;
  fitScore: number;
  banRisk: "LOW" | "MEDIUM" | "HIGH";
  bestTime: string;
  medianSignups: number;
};

export const DEMO_CHANNELS: DemoChannelRow[] = [
  { name: "Hacker News — Show HN", platform: "HACKERNEWS", audience: "~5M developers & founders", fitScore: 92, banRisk: "LOW", bestTime: "Tue–Thu, 8am ET", medianSignups: 34 },
  { name: "Product Hunt", platform: "PRODUCTHUNT", audience: "Makers & early adopters", fitScore: 88, banRisk: "LOW", bestTime: "Tue, 12:01am PT", medianSignups: 22 },
  { name: "r/devops", platform: "REDDIT", audience: "~520k platform & ops engineers", fitScore: 85, banRisk: "MEDIUM", bestTime: "Weekdays, 9–11am ET", medianSignups: 12 },
  { name: "Lobsters", platform: "LOBSTERS", audience: "High-signal engineering community", fitScore: 80, banRisk: "MEDIUM", bestTime: "Weekdays", medianSignups: 9 },
  { name: "r/selfhosted", platform: "REDDIT", audience: "~380k self-hosting enthusiasts", fitScore: 78, banRisk: "MEDIUM", bestTime: "Weekends", medianSignups: 11 },
  { name: "DEV.to", platform: "DEVTO", audience: "Developers who read long-form", fitScore: 76, banRisk: "LOW", bestTime: "Tue–Thu mornings", medianSignups: 8 },
  { name: "TikTok — Build in public", platform: "TIKTOK", audience: "Short-form · founders & devs", fitScore: 74, banRisk: "LOW", bestTime: "Weekdays, 6–9pm", medianSignups: 5 },
  { name: "Indie Hackers", platform: "INDIEHACKERS", audience: "Bootstrappers & solo founders", fitScore: 71, banRisk: "LOW", bestTime: "Weekday mornings", medianSignups: 7 },
];

// ── Ship feed (overview) ───────────────────────────────────
export type DemoFeedShip = {
  type: "LAUNCH" | "FEATURE" | "BLOG" | "OTHER";
  title: string;
  when: string;
  channels: number;
  signups: number;
};

export const DEMO_FEED = {
  stats: [
    { label: "Ships", value: "3" },
    { label: "Channels planned", value: "12" },
    { label: "Signups attributed", value: "47" },
    { label: "Revenue", value: "$312" },
  ],
  ships: [
    { type: "LAUNCH", title: "Cascade 1.0", when: "2 weeks ago", channels: 5, signups: 41 } as DemoFeedShip,
    { type: "FEATURE", title: "Point-in-time rollback", when: "5 weeks ago", channels: 4, signups: 4 } as DemoFeedShip,
    { type: "BLOG", title: "How we do zero-lock migrations", when: "7 weeks ago", channels: 3, signups: 2 } as DemoFeedShip,
  ],
} as const;
