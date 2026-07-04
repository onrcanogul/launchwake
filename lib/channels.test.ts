import { describe, it, expect } from "vitest";
import {
  deriveSignalTags,
  matchChannels,
  outcomeWeight,
  type ChannelLike,
  type ChannelOutcome,
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

describe("outcomeWeight", () => {
  const zero: ChannelOutcome = { posts: 0, clicks: 0, signups: 0, removals: 0 };

  it("ranks up a channel with first-party signups and explains why", () => {
    const w = outcomeWeight(
      { posts: 1, clicks: 40, signups: 12, removals: 0 },
      undefined,
    );
    expect(w.direction).toBe("up");
    expect(w.delta).toBeGreaterThan(0);
    expect(w.reason).toBe("ranked up: 12 signups from your last post here");
  });

  it("pluralizes 'posts' when there is more than one post", () => {
    const w = outcomeWeight(
      { posts: 3, clicks: 50, signups: 5, removals: 0 },
      undefined,
    );
    expect(w.reason).toBe("ranked up: 5 signups from your 3 posts here");
  });

  it("decays a channel with repeated traffic but zero signups", () => {
    const w = outcomeWeight(
      { posts: 3, clicks: 30, signups: 0, removals: 0 },
      undefined,
    );
    expect(w.direction).toBe("down");
    expect(w.delta).toBeLessThan(0);
    expect(w.reason).toMatch(/ranked down: 30 clicks, 0 signups across 3 posts here/);
  });

  it("does not decay on a single quiet post (not yet 'repeated')", () => {
    const w = outcomeWeight(
      { posts: 1, clicks: 2, signups: 0, removals: 0 },
      undefined,
    );
    expect(w).toEqual({ delta: 0, reason: null, direction: null });
  });

  it("penalizes removals and calls them out", () => {
    const w = outcomeWeight(
      { posts: 2, clicks: 3, signups: 0, removals: 2 },
      undefined,
    );
    expect(w.direction).toBe("down");
    expect(w.delta).toBeLessThan(0);
    expect(w.reason).toMatch(/2 removals here — post carefully/);
  });

  it("still calls out removals even when a channel converted", () => {
    const w = outcomeWeight(
      { posts: 4, clicks: 50, signups: 6, removals: 1 },
      undefined,
    );
    expect(w.reason).toContain("ranked up: 6 signups");
    expect(w.reason).toContain("1 removal here — post carefully");
  });

  it("caps the up-weight so one lucky post cannot dominate", () => {
    const w = outcomeWeight(
      { posts: 1, clicks: 500, signups: 500, removals: 0 },
      undefined,
    );
    expect(w.delta).toBeLessThanOrEqual(30);
  });

  it("falls back to the category benchmark when there is no first-party history", () => {
    const w = outcomeWeight(zero, { medianSignups: 8, sampleSize: 12 });
    expect(w.direction).toBe("up");
    expect(w.delta).toBe(8);
    expect(w.reason).toBe(
      "ranked up: similar products see a median of 8 signups here",
    );
  });

  it("ignores the benchmark once the project has its own history", () => {
    const w = outcomeWeight(
      { posts: 2, clicks: 20, signups: 0, removals: 0 },
      { medianSignups: 40, sampleSize: 99 },
    );
    // first-party decay wins; benchmark is not consulted
    expect(w.direction).toBe("down");
  });

  it("returns a neutral weight when there is nothing to say", () => {
    expect(outcomeWeight(undefined, undefined)).toEqual({
      delta: 0,
      reason: null,
      direction: null,
    });
    expect(outcomeWeight(zero, { medianSignups: 0, sampleSize: 0 })).toEqual({
      delta: 0,
      reason: null,
      direction: null,
    });
  });
});

describe("matchChannels outcome weighting", () => {
  // A proven-but-off-topic channel vs. a topically strong one that keeps dying.
  const c: ChannelLike[] = [
    {
      id: "proven",
      slug: "r-proven",
      name: "r/Proven",
      platform: "REDDIT",
      defaultBanRisk: "MEDIUM",
      // Only ONE overlapping tag — would rank low on tags alone.
      tags: ["developers"],
    },
    {
      id: "dead",
      slug: "hn-dead",
      name: "HN Dead",
      platform: "HACKERNEWS",
      defaultBanRisk: "LOW",
      // Strong tag overlap for a devtools/api ship.
      tags: ["developers", "devtools", "api", "backend"],
    },
  ];
  const ctx = {
    projectText: "an api devtool for backend developers",
    shipText: "new api feature",
    shipType: "FEATURE",
  };

  it("surfaces a proven channel above a strong-tag channel that keeps dying", () => {
    const ranked = matchChannels(
      c,
      {
        ...ctx,
        outcomes: {
          firstParty: new Map([
            ["proven", { posts: 2, clicks: 60, signups: 15, removals: 0 }],
            ["dead", { posts: 4, clicks: 40, signups: 0, removals: 0 }],
          ]),
        },
      },
      2,
    );
    expect(ranked[0].channel.slug).toBe("r-proven");
    expect(ranked[0].outcomeDelta).toBeGreaterThan(0);
    expect(ranked[0].outcomeReason).toContain("ranked up");
    const dead = ranked.find((r) => r.channel.slug === "hn-dead")!;
    expect(dead.outcomeDelta).toBeLessThan(0);
    expect(dead.outcomeReason).toContain("ranked down");
  });

  it("without outcomes, the strong-tag channel wins (regression guard)", () => {
    const ranked = matchChannels(c, ctx, 2);
    expect(ranked[0].channel.slug).toBe("hn-dead");
    expect(ranked[0].outcomeDelta).toBe(0);
    expect(ranked[0].outcomeReason).toBeNull();
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
