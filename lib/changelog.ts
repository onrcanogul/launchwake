/**
 * The public changelog. Content lives here as typed data (no CMS) — add an entry
 * to the top and it shows on /changelog and in the RSS feed. Newest first.
 */

export type ChangeTag = "New" | "Improved" | "Fixed";

export type ChangelogEntry = {
  /** Stable anchor slug. */
  slug: string;
  /** ISO date (YYYY-MM-DD). */
  date: string;
  title: string;
  tags: ChangeTag[];
  /** What shipped, as short bullets. */
  items: string[];
};

export const CHANGELOG: ChangelogEntry[] = [
  {
    slug: "public-launch-reports",
    date: "2026-07-02",
    title: "Public Launch Reports + “Powered by LaunchWake” badge",
    tags: ["New"],
    items: [
      "Flip any launch public to get a shareable /report page: the channel plan you ran and what it drove (clicks, signups, and — if you opt in — revenue).",
      "Every report renders a dynamic social card, so shares on X and LinkedIn show your outcome numbers.",
      "Embed the “Powered by LaunchWake” badge on your own site with a one-line snippet.",
    ],
  },
  {
    slug: "team-plan",
    date: "2026-07-02",
    title: "Team plan — seat-based tier for agencies & DevRel",
    tags: ["New"],
    items: [
      "New Team tier: unlimited everything, billed per seat ($29/seat, 3-seat minimum).",
      "Manage seats from the billing portal; entitlements scale with your team.",
    ],
  },
  {
    slug: "launch-day",
    date: "2026-07-01",
    title: "Launch day — a time-ordered run sheet",
    tags: ["New"],
    items: [
      "Turn a plan into one checklist: channels ordered by best time, grouped into windows.",
      "Copy each draft, mark it posted (mints the tracked link), and set reminders — with a live progress bar.",
    ],
  },
  {
    slug: "revenue-attribution",
    date: "2026-07-01",
    title: "Revenue attribution + per-launch ROI",
    tags: ["New", "Improved"],
    items: [
      "Attribute money, not just signups: a provider-agnostic revenue API plus a turnkey Stripe webhook.",
      "Every launch gets an ROI headline — “~2h work → 340 clicks → 41 signups → $340”.",
      "Results now break revenue and MRR down per channel.",
    ],
  },
  {
    slug: "catalog-105",
    date: "2026-06-30",
    title: "Channel catalog expanded to 100+",
    tags: ["Improved"],
    items: [
      "Grew the catalog from 20 to 105 real communities: niche subreddits, newsletters, directories, and Discord/Slack servers.",
      "Smarter matching connects your product's stack (Rust, Go, Python, …) to its niche channels.",
    ],
  },
  {
    slug: "outcome-reranking",
    date: "2026-06-30",
    title: "Plans that learn from real outcomes",
    tags: ["Improved"],
    items: [
      "The ranker now weights past results — channels that converted rise; traffic that never converted sinks.",
      "The “why this channel” card shows the evidence, so every launch gets smarter.",
    ],
  },
  {
    slug: "public-tools-landing",
    date: "2026-06-29",
    title: "Free tools + a real landing page",
    tags: ["New"],
    items: [
      "Launch Checker: paste a GitHub repo, get a ranked mini-plan — no login.",
      "Ban Risk Lookup: public pages for every community's rules and ban risk.",
    ],
  },
];

/** Newest-first entries (already authored in order; sorted defensively). */
export function getChangelog(): ChangelogEntry[] {
  return [...CHANGELOG].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

export function formatChangelogDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

const TAG_COLOR: Record<ChangeTag, string> = {
  New: "var(--ac)",
  Improved: "var(--vi)",
  Fixed: "var(--warn)",
};

export function tagColor(tag: ChangeTag): string {
  return TAG_COLOR[tag];
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Build an RSS 2.0 feed for the changelog (pure). */
export function changelogRss(baseUrl: string): string {
  const base = baseUrl.replace(/\/$/, "");
  const items = getChangelog()
    .map((e) => {
      const link = `${base}/changelog#${e.slug}`;
      const desc = e.items.map((i) => `• ${i}`).join("\n");
      const pubDate = new Date(`${e.date}T00:00:00Z`).toUTCString();
      return `    <item>
      <title>${escapeXml(e.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="false">${e.slug}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml(desc)}</description>
    </item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>LaunchWake — Changelog</title>
    <link>${base}/changelog</link>
    <description>New features and improvements in LaunchWake.</description>
${items}
  </channel>
</rss>`;
}
