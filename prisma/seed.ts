import { PrismaClient, Platform, BanRisk } from "@prisma/client";

const db = new PrismaClient();

/**
 * Seed the global channel catalog — the intelligence asset.
 *
 * These are REAL communities with REAL posting norms. The LLM may only rank and
 * justify channels from this set; it must never invent communities (inventing a
 * fake subreddit is how users get banned). Tags drive candidate matching in
 * lib/channels.ts before the LLM ranks.
 */

type Seed = {
  slug: string;
  name: string;
  platform: Platform;
  url: string;
  audienceDesc: string;
  rules: string;
  defaultBanRisk: BanRisk;
  bestTime: string;
  tags: string[];
};

const channels: Seed[] = [
  {
    slug: "hn-show",
    name: "Hacker News — Show HN",
    platform: Platform.HACKERNEWS,
    url: "https://news.ycombinator.com/show",
    audienceDesc: "~5M developers & founders · very high intent",
    rules:
      "Show HN is for something you built that people can try. Lead with the problem and the build story, not marketing. No hype adjectives. Reply to every comment. Title format: 'Show HN: <what it is>'.",
    defaultBanRisk: BanRisk.LOW,
    bestTime: "Tue–Thu 8am ET",
    tags: [
      "developers",
      "devtools",
      "infra",
      "technical",
      "launch",
      "opensource",
      "api",
      "backend",
      "startup",
    ],
  },
  {
    slug: "hn",
    name: "Hacker News",
    platform: Platform.HACKERNEWS,
    url: "https://news.ycombinator.com",
    audienceDesc: "front page · technical, skeptical, high reach",
    rules:
      "Submit a link (blog post, writeup) — not a pitch. Substance wins; titles must be factual, no clickbait. Best for deep technical writeups and launches with a story.",
    defaultBanRisk: BanRisk.LOW,
    bestTime: "Tue–Thu 8am ET",
    tags: [
      "developers",
      "technical",
      "blog",
      "writeup",
      "infra",
      "backend",
      "security",
      "opensource",
    ],
  },
  {
    slug: "product-hunt",
    name: "Product Hunt",
    platform: Platform.PRODUCTHUNT,
    url: "https://www.producthunt.com",
    audienceDesc: "makers, early adopters, PMs",
    rules:
      "Launch goes live 00:01 PT and runs 24h. Prepare assets (gallery, first comment, maker story) ahead. Rally your network early; don't buy upvotes (grounds for removal). One clear tagline.",
    defaultBanRisk: BanRisk.LOW,
    bestTime: "Tue 00:01 PT",
    tags: [
      "launch",
      "product",
      "saas",
      "devtools",
      "makers",
      "startup",
      "b2b",
    ],
  },
  {
    slug: "indie-hackers",
    name: "Indie Hackers — Show IH",
    platform: Platform.INDIEHACKERS,
    url: "https://www.indiehackers.com",
    audienceDesc: "warm founder & bootstrapper community",
    rules:
      "Value-first. Share what you built, why, and the numbers (revenue, users, lessons). Transparency is rewarded; pure promotion is ignored. Engage in the comments.",
    defaultBanRisk: BanRisk.LOW,
    bestTime: "Weekday mornings",
    tags: [
      "founders",
      "indie",
      "saas",
      "startup",
      "product",
      "b2b",
      "makers",
    ],
  },
  {
    slug: "r-webdev",
    name: "r/webdev",
    platform: Platform.REDDIT,
    url: "https://www.reddit.com/r/webdev",
    audienceDesc: "2.6M members · web developers",
    rules:
      "Strict 90/10 self-promo rule: 9 value posts per 1 promo. No links in titles. Showoff Saturday for projects. Frame as a guide/lesson, mention the tool as context only.",
    defaultBanRisk: BanRisk.MEDIUM,
    bestTime: "Mon/Wed 9am ET",
    tags: ["webdev", "frontend", "javascript", "developers", "api", "devtools"],
  },
  {
    slug: "r-saas",
    name: "r/SaaS",
    platform: Platform.REDDIT,
    url: "https://www.reddit.com/r/SaaS",
    audienceDesc: "SaaS founders & operators",
    rules:
      "Heavily moderated for self-promo. Share lessons/metrics, not pitches. Direct product links often removed. Read the rules; a removed post can hurt account standing.",
    defaultBanRisk: BanRisk.HIGH,
    bestTime: "Tue–Thu 10am ET",
    tags: ["saas", "founders", "b2b", "startup", "product"],
  },
  {
    slug: "r-programming",
    name: "r/programming",
    platform: Platform.REDDIT,
    url: "https://www.reddit.com/r/programming",
    audienceDesc: "6M+ · general programming, skeptical",
    rules:
      "Technical articles only, no product promotion. Self-promo is quickly removed and downvoted. Only submit a genuinely substantive writeup that stands on its own.",
    defaultBanRisk: BanRisk.HIGH,
    bestTime: "Weekday mornings ET",
    tags: [
      "developers",
      "technical",
      "blog",
      "writeup",
      "backend",
      "opensource",
    ],
  },
  {
    slug: "r-devops",
    name: "r/devops",
    platform: Platform.REDDIT,
    url: "https://www.reddit.com/r/devops",
    audienceDesc: "SRE / platform / infra engineers",
    rules:
      "Practitioners dislike ads. Share an operational lesson or architecture; tool mention as a footnote. No link-in-title. Genuine discussion of failure modes lands well.",
    defaultBanRisk: BanRisk.MEDIUM,
    bestTime: "Tue–Thu 9am ET",
    tags: ["devops", "infra", "backend", "developers", "security", "api"],
  },
  {
    slug: "r-selfhosted",
    name: "r/selfhosted",
    platform: Platform.REDDIT,
    url: "https://www.reddit.com/r/selfhosted",
    audienceDesc: "self-hosting & open-source enthusiasts",
    rules:
      "Open-source / self-hostable tools welcomed if you're transparent. Show a real setup and screenshots. Closed-source SaaS gets a colder reception — be upfront about pricing.",
    defaultBanRisk: BanRisk.MEDIUM,
    bestTime: "Weekend mornings",
    tags: ["selfhosted", "opensource", "infra", "devtools", "developers"],
  },
  {
    slug: "r-node",
    name: "r/node",
    platform: Platform.REDDIT,
    url: "https://www.reddit.com/r/node",
    audienceDesc: "Node.js developers",
    rules:
      "Node-specific technical content. Self-promo tolerated if genuinely useful and clearly relevant to Node. Explain the how, not just the what.",
    defaultBanRisk: BanRisk.MEDIUM,
    bestTime: "Weekday mornings ET",
    tags: ["node", "javascript", "backend", "developers", "api", "webhooks"],
  },
  {
    slug: "r-javascript",
    name: "r/javascript",
    platform: Platform.REDDIT,
    url: "https://www.reddit.com/r/javascript",
    audienceDesc: "1.9M · JS developers",
    rules:
      "Showoff posts restricted to weekly threads; standalone promo removed. Must be substantive JS content. Very sensitive to marketing tone.",
    defaultBanRisk: BanRisk.HIGH,
    bestTime: "Weekday mornings ET",
    tags: ["javascript", "frontend", "node", "developers", "webdev"],
  },
  {
    slug: "r-startups",
    name: "r/startups",
    platform: Platform.REDDIT,
    url: "https://www.reddit.com/r/startups",
    audienceDesc: "founders & early operators",
    rules:
      "Promotion only in the weekly 'Share Your Startup' thread. Elsewhere, contribute advice/lessons. Direct launches outside the thread are removed.",
    defaultBanRisk: BanRisk.MEDIUM,
    bestTime: "Weekday mornings ET",
    tags: ["startup", "founders", "saas", "product", "b2b"],
  },
  {
    slug: "r-entrepreneur",
    name: "r/Entrepreneur",
    platform: Platform.REDDIT,
    url: "https://www.reddit.com/r/Entrepreneur",
    audienceDesc: "broad entrepreneur audience",
    rules:
      "No direct promotion; share the journey and lessons. Less technical crowd — frame benefits in business terms. Links often flagged.",
    defaultBanRisk: BanRisk.MEDIUM,
    bestTime: "Weekday mornings ET",
    tags: ["founders", "startup", "saas", "b2b", "product"],
  },
  {
    slug: "dev-to",
    name: "dev.to",
    platform: Platform.DEVTO,
    url: "https://dev.to",
    audienceDesc: "developer blogging community",
    rules:
      "Publish a genuine technical article (tutorial, walkthrough, retro). Product mention fine if the post teaches something. Use tags (#webdev, #node). Canonical-URL your own blog.",
    defaultBanRisk: BanRisk.LOW,
    bestTime: "Any weekday morning",
    tags: [
      "blog",
      "writeup",
      "developers",
      "webdev",
      "javascript",
      "node",
      "devtools",
      "technical",
    ],
  },
  {
    slug: "hashnode",
    name: "Hashnode",
    platform: Platform.DEVTO,
    url: "https://hashnode.com",
    audienceDesc: "developer blogging network",
    rules:
      "Technical writing platform with a dev community. Long-form tutorials and engineering deep-dives perform best. Own your domain via the mapped blog.",
    defaultBanRisk: BanRisk.LOW,
    bestTime: "Any weekday",
    tags: ["blog", "writeup", "developers", "technical", "backend", "webdev"],
  },
  {
    slug: "lobsters",
    name: "Lobste.rs",
    platform: Platform.LOBSTERS,
    url: "https://lobste.rs",
    audienceDesc: "invite-only · high-signal technical crowd",
    rules:
      "Invite-only; tightly moderated. Only deep technical content, tagged correctly. Self-promo must be disclosed and is discouraged unless genuinely notable. No marketing whatsoever.",
    defaultBanRisk: BanRisk.MEDIUM,
    bestTime: "Invite only",
    tags: [
      "developers",
      "technical",
      "writeup",
      "infra",
      "backend",
      "security",
      "opensource",
    ],
  },
  {
    slug: "x",
    name: "X (Twitter)",
    platform: Platform.X,
    url: "https://x.com",
    audienceDesc: "dev-Twitter, build-in-public founders",
    rules:
      "Hook in the first line, link last (or in a reply — links can suppress reach). Thread format for features. Post Tue–Thu mornings. Engage replies fast for the algorithm.",
    defaultBanRisk: BanRisk.LOW,
    bestTime: "Tue–Thu 9am ET",
    tags: [
      "founders",
      "developers",
      "indie",
      "startup",
      "product",
      "launch",
      "saas",
    ],
  },
  {
    slug: "linkedin",
    name: "LinkedIn",
    platform: Platform.LINKEDIN,
    url: "https://www.linkedin.com",
    audienceDesc: "B2B buyers, professional network",
    rules:
      "Put the link in the first comment — LinkedIn throttles posts with outbound links. Lead with a personal/professional angle. Business value framing beats technical detail.",
    defaultBanRisk: BanRisk.LOW,
    bestTime: "Tue–Thu 8–10am local",
    tags: ["b2b", "saas", "founders", "product", "startup"],
  },
  {
    slug: "wip",
    name: "WIP",
    platform: Platform.INDIEHACKERS,
    url: "https://wip.co",
    audienceDesc: "maker community shipping in public",
    rules:
      "Log what you shipped as a completed todo; makers follow along. Friendly to frequent small updates. Value-first, low pressure — a good home for every ship.",
    defaultBanRisk: BanRisk.LOW,
    bestTime: "Any day",
    tags: ["makers", "indie", "founders", "product", "startup", "launch"],
  },
  {
    slug: "betalist",
    name: "BetaList",
    platform: Platform.OTHER,
    url: "https://betalist.com",
    audienceDesc: "early-adopter directory for pre-launch startups",
    rules:
      "For early-stage startups seeking first users. Submit for a feature; queue can take weeks. One-time exposure — best for an initial launch, not every ship.",
    defaultBanRisk: BanRisk.LOW,
    bestTime: "Anytime (queued)",
    tags: ["launch", "startup", "saas", "product", "b2b"],
  },
];

async function main() {
  for (const c of channels) {
    await db.channel.upsert({
      where: { slug: c.slug },
      update: {
        name: c.name,
        platform: c.platform,
        url: c.url,
        audienceDesc: c.audienceDesc,
        rules: c.rules,
        defaultBanRisk: c.defaultBanRisk,
        bestTime: c.bestTime,
        tags: c.tags,
      },
      create: c,
    });
  }
  const count = await db.channel.count();
  console.log(`Seeded channel catalog — ${count} channels.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
