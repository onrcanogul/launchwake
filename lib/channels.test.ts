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

  it("maps hardware/embedded keywords to the hardware pack tags", () => {
    const tags = deriveSignalTags({
      projectText: "OpenTrace — a KiCad plugin for PCB design and firmware",
      shipText: "New microcontroller board bring-up guide",
      shipType: "FEATURE",
    });
    expect(tags.has("pcb")).toBe(true);
    expect(tags.has("hardware")).toBe(true);
    expect(tags.has("electronics")).toBe(true);
    expect(tags.has("firmware")).toBe(true);
    expect(tags.has("embedded")).toBe(true);
  });

  it("maps macOS keywords to the desktop pack tags", () => {
    const tags = deriveSignalTags({
      projectText: "BarKit — a macOS menu bar app",
      shipText: "1.0 launch",
      shipType: "LAUNCH",
    });
    expect(tags.has("macos")).toBe(true);
    expect(tags.has("desktop")).toBe(true);
  });

  it("maps a privacy keyword to the privacy/security tags", () => {
    const tags = deriveSignalTags({
      projectText: "A privacy-first analytics tool",
      shipText: "launch",
      shipType: "LAUNCH",
    });
    expect(tags.has("privacy")).toBe(true);
    expect(tags.has("security")).toBe(true);
  });

  it("does not fire the CLI tag on the substring in 'client'", () => {
    const tags = deriveSignalTags({
      projectText: "A billing tool for your clients",
      shipText: "new invoice view",
      shipType: "FEATURE",
    });
    expect(tags.has("cli")).toBe(false);
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
