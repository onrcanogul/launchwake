import { describe, it, expect } from "vitest";
import {
  deriveSignalTags,
  matchChannels,
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
