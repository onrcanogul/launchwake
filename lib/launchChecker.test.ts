import { describe, it, expect } from "vitest";
import { buildPublicPlan, PUBLIC_FREE_RECS } from "./launchChecker";
import type { ChannelLike } from "./channels";

const catalog: ChannelLike[] = [
  {
    id: "1",
    slug: "hn-show",
    name: "Hacker News — Show HN",
    platform: "HACKERNEWS",
    audienceDesc: "devs",
    rules: "Lead with the build story. No hype.",
    defaultBanRisk: "LOW",
    bestTime: "Tue 8am ET",
    tags: ["developers", "devtools", "api", "backend", "launch"],
  },
  {
    id: "2",
    slug: "r-node",
    name: "r/node",
    platform: "REDDIT",
    rules: "Node-specific content only.",
    defaultBanRisk: "MEDIUM",
    bestTime: "Weekday mornings",
    tags: ["node", "javascript", "backend", "api", "webhooks"],
  },
  {
    id: "3",
    slug: "r-saas",
    name: "r/SaaS",
    platform: "REDDIT",
    rules: "Heavily moderated. No pitches.",
    defaultBanRisk: "HIGH",
    bestTime: "Tue 10am ET",
    tags: ["saas", "founders", "b2b"],
  },
  {
    id: "4",
    slug: "linkedin",
    name: "LinkedIn",
    platform: "LINKEDIN",
    rules: "Link in first comment.",
    defaultBanRisk: "LOW",
    bestTime: "Tue 9am",
    tags: ["b2b", "saas", "founders"],
  },
];

const input = {
  project: {
    name: "Hookdeck",
    description: "A reliable webhook API and backend infrastructure for Node.",
    url: "https://hookdeck.com",
    githubRepo: "hookdeck/hookdeck",
  },
  ship: { type: "LAUNCH" as const, title: "v1.0 launch", summary: "Webhook API GA" },
};

describe("buildPublicPlan", () => {
  it("returns catalog-grounded recs (never invents a channel)", () => {
    const plan = buildPublicPlan(catalog, input);
    const slugs = new Set(catalog.map((c) => c.slug));
    expect(plan.recs.length).toBeGreaterThan(0);
    for (const r of plan.recs) expect(slugs.has(r.slug)).toBe(true);
  });

  it("ranks the webhook/node/backend product's dev channels above generic B2B", () => {
    const plan = buildPublicPlan(catalog, input);
    const rank = (slug: string) => plan.recs.findIndex((r) => r.slug === slug);
    // HN Show and r/node match developer/backend/api/webhook tags strongly.
    expect(rank("hn-show")).toBeLessThan(rank("r-saas"));
    expect(rank("r-node")).toBeLessThan(rank("r-saas"));
  });

  it("carries ban risk straight from the catalog default", () => {
    const plan = buildPublicPlan(catalog, input);
    const saas = plan.recs.find((r) => r.slug === "r-saas");
    expect(saas?.banRisk).toBe("HIGH");
    const hn = plan.recs.find((r) => r.slug === "hn-show");
    expect(hn?.banRisk).toBe("LOW");
  });

  it("sorts recs by descending fit score", () => {
    const plan = buildPublicPlan(catalog, input);
    for (let i = 1; i < plan.recs.length; i++) {
      expect(plan.recs[i - 1].fitScore).toBeGreaterThanOrEqual(
        plan.recs[i].fitScore,
      );
    }
  });

  it("synthesizes a ship from the project when none is provided", () => {
    const plan = buildPublicPlan(catalog, { project: input.project, ship: null });
    expect(plan.ship).toBeNull();
    expect(plan.recs.length).toBeGreaterThan(0);
  });

  it("ranks from GitHub topics even with no release (project-first)", () => {
    // Deliberately vague name/description; the signal lives entirely in topics.
    const plan = buildPublicPlan(catalog, {
      project: {
        name: "acme",
        description: "an internal tool",
        url: null,
        githubRepo: "acme/acme",
        topics: ["nodejs", "webhooks", "backend", "api"],
        language: "TypeScript",
      },
      ship: null,
    });
    const rank = (slug: string) => plan.recs.findIndex((r) => r.slug === slug);
    // Topics alone should surface the node/backend/api channel above generic B2B.
    expect(rank("r-node")).toBeGreaterThanOrEqual(0);
    expect(rank("r-node")).toBeLessThan(rank("r-saas"));
  });

  it("normalizes hyphenated topics so multi-word keywords match", () => {
    // "machine learning" is a two-word keyword; a GitHub topic arrives hyphenated.
    // The ml channel only wins the top slot if we normalize the hyphen away.
    const mlCatalog: ChannelLike[] = [
      { ...catalog[3] }, // linkedin: b2b/saas/founders — no ml signal
      {
        id: "5",
        slug: "r-ml",
        name: "r/MachineLearning",
        platform: "REDDIT",
        rules: "Research-grade only.",
        defaultBanRisk: "MEDIUM",
        bestTime: "Weekdays",
        tags: ["ml", "ai", "data"],
      },
    ];
    const plan = buildPublicPlan(mlCatalog, {
      project: { name: "x", topics: ["machine-learning"], githubRepo: "x/x" },
      ship: null,
    });
    expect(plan.recs[0].slug).toBe("r-ml");
  });

  it("reports the total catalog size for the gated teaser", () => {
    const plan = buildPublicPlan(catalog, input);
    expect(plan.totalChannels).toBe(catalog.length);
    // There is something to gate beyond the free reveal.
    expect(plan.recs.length).toBeGreaterThan(0);
    expect(PUBLIC_FREE_RECS).toBeGreaterThan(0);
  });
});
