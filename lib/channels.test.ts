import { describe, it, expect } from "vitest";
import {
  deriveSignalTags,
  matchChannels,
  isShortformChannel,
  SHORTFORM_TAG,
  type ChannelLike,
} from "./channels";

const catalog: ChannelLike[] = [
  {
    id: "1",
    slug: "hn-show",
    name: "Hacker News — Show HN",
    platform: "HACKERNEWS",
    defaultBanRisk: "LOW",
    tags: ["developers", "devtools", "infra", "launch", "api", "backend"],
  },
  {
    id: "2",
    slug: "r-webdev",
    name: "r/webdev",
    platform: "REDDIT",
    defaultBanRisk: "MEDIUM",
    tags: ["webdev", "frontend", "javascript", "developers", "api"],
  },
  {
    id: "3",
    slug: "r-saas",
    name: "r/SaaS",
    platform: "REDDIT",
    defaultBanRisk: "HIGH",
    tags: ["saas", "founders", "b2b"],
  },
  {
    id: "4",
    slug: "linkedin",
    name: "LinkedIn",
    platform: "LINKEDIN",
    defaultBanRisk: "LOW",
    tags: ["b2b", "saas", "founders"],
  },
];

describe("deriveSignalTags", () => {
  it("maps product keywords to fit tags", () => {
    const tags = deriveSignalTags({
      projectText: "Hookline — a webhook testing tool for developers",
      shipText: "Added Slack alerts for failed webhooks",
      shipType: "FEATURE",
    });
    expect(tags.has("webhooks")).toBe(true);
    expect(tags.has("api")).toBe(true);
    expect(tags.has("devtools")).toBe(true);
    // baseline signal always present
    expect(tags.has("developers")).toBe(true);
    // ship-type nudge
    expect(tags.has("product")).toBe(true);
  });

  it("adds blog/writeup signal for BLOG ships", () => {
    const tags = deriveSignalTags({
      projectText: "Hookline",
      shipText: "How we cut webhook latency by 40%",
      shipType: "BLOG",
    });
    expect(tags.has("blog")).toBe(true);
    expect(tags.has("writeup")).toBe(true);
  });

  it("derives consumer/visual tags from strong product phrases", () => {
    const tags = deriveSignalTags({
      projectText: "A consumer mobile app to edit your photos",
      shipText: "New filters",
      shipType: "LAUNCH",
    });
    expect(tags.has("consumer")).toBe(true);
    expect(tags.has("mobile-app")).toBe(true);
    // baseline signal still present
    expect(tags.has("developers")).toBe(true);
  });
});

describe("matchChannels", () => {
  it("ranks a devtools ship: HN and r/webdev over r/SaaS", () => {
    const ranked = matchChannels(
      catalog,
      {
        projectText: "Hookline — webhook testing tool for developers, an API devtool",
        shipText: "Added Slack alerts for failed webhooks",
        shipType: "FEATURE",
      },
      4,
    );
    const order = ranked.map((r) => r.channel.slug);
    expect(order[0]).toBe("hn-show");
    expect(order).toContain("r-webdev");
    // r/SaaS (high ban risk, weak overlap) ranks below the devtools channels
    expect(order.indexOf("r-saas")).toBeGreaterThan(order.indexOf("r-webdev"));
  });

  it("respects the limit and never exceeds the catalog", () => {
    const ranked = matchChannels(
      catalog,
      { projectText: "a b2b saas tool", shipText: "launch", shipType: "LAUNCH" },
      2,
    );
    expect(ranked).toHaveLength(2);
  });

  it("always returns candidates even with no keyword overlap", () => {
    const ranked = matchChannels(
      catalog,
      { projectText: "", shipText: "", shipType: "OTHER" },
      3,
    );
    expect(ranked.length).toBe(3);
    // baseline 'developers' tag means channels tagged developers still surface first
    expect(ranked[0].channel.tags).toContain("developers");
  });
});

describe("matchChannels launch context", () => {
  const c: ChannelLike[] = [
    {
      id: "ph",
      slug: "product-hunt",
      name: "Product Hunt",
      platform: "PRODUCTHUNT",
      defaultBanRisk: "LOW",
      tags: ["launch", "product", "startup"],
    },
    {
      id: "devto",
      slug: "dev-to",
      name: "dev.to",
      platform: "DEVTO",
      defaultBanRisk: "LOW",
      tags: ["blog", "writeup", "developers"],
    },
  ];
  const ctx = { projectText: "a small tool", shipText: "first release" };

  it("favors launch venues when launchContext is set", () => {
    const order = matchChannels(c, { ...ctx, launchContext: true }, 2).map(
      (r) => r.channel.slug,
    );
    expect(order[0]).toBe("product-hunt");
  });

  it("does not add the launch boost without launchContext", () => {
    // dev.to matches the baseline 'developers' tag; Product Hunt matches nothing.
    const order = matchChannels(c, ctx, 2).map((r) => r.channel.slug);
    expect(order[0]).toBe("dev-to");
  });

  it("adds launch/product signal tags only in launch context", () => {
    expect(deriveSignalTags({ ...ctx, launchContext: true }).has("launch")).toBe(true);
    expect(deriveSignalTags(ctx).has("launch")).toBe(false);
  });
});

// ── Short-form video fit-gating ────────────────────────────
describe("consumer/visual tag detection (deriveSignalTags)", () => {
  it("tags a consumer mobile app with visual/consumer signals", () => {
    const tags = deriveSignalTags({
      projectText: "A consumer mobile app for iPhone to edit your photos",
      shipText: "New photo filters",
      shipType: "LAUNCH",
    });
    expect(tags.has("mobile-app")).toBe(true);
    expect(tags.has("consumer")).toBe(true);
  });

  it("tags a game with the game/consumer signals", () => {
    const tags = deriveSignalTags({
      projectText: "A cozy pixel-art indie game about farming",
      shipText: "1.0 launch",
      shipType: "LAUNCH",
    });
    expect(tags.has("game")).toBe(true);
    expect(tags.has("consumer")).toBe(true);
  });

  it("does NOT tag a CLI devtool as consumer/visual (fail-closed)", () => {
    const tags = deriveSignalTags({
      projectText: "A command-line devtool for developers to run Postgres migrations",
      shipText: "CLI v2 release",
      shipType: "LAUNCH",
    });
    for (const t of ["consumer", "mobile-app", "visual-demo", "game", "b2c"]) {
      expect(tags.has(t), `should not derive "${t}"`).toBe(false);
    }
    // still a real, developer-tagged product
    expect(tags.has("devtools")).toBe(true);
  });
});

const tiktok: ChannelLike = {
  id: "sf-tt",
  slug: "tiktok-app-demo",
  name: "TikTok — App Demo",
  platform: "TIKTOK",
  defaultBanRisk: "LOW",
  tags: [SHORTFORM_TAG, "mobile-app", "consumer", "visual-demo"],
};
const hn: ChannelLike = {
  id: "hn",
  slug: "hn-show",
  name: "Show HN",
  platform: "HACKERNEWS",
  defaultBanRisk: "LOW",
  tags: ["developers", "devtools", "launch"],
};
const li: ChannelLike = {
  id: "li",
  slug: "linkedin",
  name: "LinkedIn",
  platform: "LINKEDIN",
  defaultBanRisk: "LOW",
  tags: ["b2b", "saas", "founders"],
};

describe("isShortformChannel", () => {
  it("identifies short-form channels by the marker tag", () => {
    expect(isShortformChannel(tiktok)).toBe(true);
    expect(isShortformChannel(hn)).toBe(false);
  });
});

describe("matchChannels — short-form is scored, not gated", () => {
  const catalogWithShortform: ChannelLike[] = [tiktok, hn, li];

  it("ranks short-form top for a visual consumer app (positive tag overlap)", () => {
    const ranked = matchChannels(
      catalogWithShortform,
      {
        projectText: "A consumer mobile app to edit your photos",
        shipText: "New photo filters",
        shipType: "OTHER",
      },
      10,
    );
    expect(ranked[0].channel.slug).toBe("tiktok-app-demo");
    expect(ranked[0].matchedTags).toEqual(
      expect.arrayContaining(["mobile-app", "consumer"]),
    );
  });

  it("sinks short-form below matching channels for a CLI devtool (no hard gate)", () => {
    const ranked = matchChannels(
      catalogWithShortform,
      {
        projectText:
          "A command-line devtool for developers to run Postgres database migrations",
        shipText: "CLI v2 release",
        shipType: "LAUNCH",
        launchContext: true,
      },
      catalogWithShortform.length,
    );
    const slugs = ranked.map((r) => r.channel.slug);
    // Present (no exclusion) but with zero tag overlap it ranks below the real
    // dev channel — so a tight top slice never picks it up on its own.
    expect(slugs).toContain("tiktok-app-demo");
    expect(slugs.indexOf("hn-show")).toBeLessThan(slugs.indexOf("tiktok-app-demo"));
    expect(ranked.find((r) => r.channel.slug === "tiktok-app-demo")!.matchedTags).toEqual([]);
  });

  it("does not float short-form into a tight top slice for a devtool", () => {
    const ranked = matchChannels(
      catalogWithShortform,
      {
        projectText: "A command-line devtool for developers to run Postgres migrations",
        shipText: "CLI v2 release",
        shipType: "LAUNCH",
        launchContext: true,
      },
      1,
    );
    expect(ranked.map((r) => r.channel.slug)).not.toContain("tiktok-app-demo");
  });
});
