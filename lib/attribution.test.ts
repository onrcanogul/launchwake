import { describe, it, expect } from "vitest";
import {
  generateShortCode,
  slugifyCampaign,
  buildDestUrl,
  buildInsight,
  type ResultRow,
} from "./attribution";

describe("generateShortCode", () => {
  it("is URL-safe and the requested length", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateShortCode(7);
      expect(code).toHaveLength(7);
      expect(code).toMatch(/^[0-9A-Za-z]+$/);
    }
  });
  it("is effectively unique across many draws", () => {
    const set = new Set(Array.from({ length: 500 }, () => generateShortCode()));
    expect(set.size).toBe(500);
  });
});

describe("slugifyCampaign", () => {
  it("kebab-cases and strips punctuation", () => {
    expect(slugifyCampaign("Added Slack alerts for failed webhooks!")).toBe(
      "added-slack-alerts-for-failed-webhooks",
    );
  });
});

describe("buildDestUrl", () => {
  it("appends channel-specific UTM params", () => {
    const url = buildDestUrl(
      "https://hookline.dev/",
      "HACKERNEWS",
      "v1.0 beta",
    );
    const u = new URL(url);
    expect(u.searchParams.get("utm_source")).toBe("hackernews");
    expect(u.searchParams.get("utm_medium")).toBe("launchwake");
    expect(u.searchParams.get("utm_campaign")).toBe("v1-0-beta");
  });
  it("preserves existing query params", () => {
    const url = buildDestUrl("https://hookline.dev/?plan=pro", "X", "ship");
    const u = new URL(url);
    expect(u.searchParams.get("plan")).toBe("pro");
    expect(u.searchParams.get("utm_source")).toBe("x");
  });
});

describe("buildInsight", () => {
  it("returns null with no data", () => {
    expect(buildInsight([])).toBeNull();
  });
  it("recommends doubling down on the best converter", () => {
    const rows: ResultRow[] = [
      { channelName: "Hacker News", shipTitle: "beta", trackedUrl: null, postUrl: null, clicks: 100, signups: 5, conversion: 0.05, removed: false },
      { channelName: "X", shipTitle: "beta", trackedUrl: null, postUrl: null, clicks: 100, signups: 2, conversion: 0.02, removed: false },
    ];
    const insight = buildInsight(rows)!;
    expect(insight).toMatch(/Hacker News/);
    expect(insight).toMatch(/double down/i);
  });
  it("flags a removed post when nothing converts", () => {
    const rows: ResultRow[] = [
      { channelName: "r/SaaS", shipTitle: "beta", trackedUrl: null, postUrl: null, clicks: 10, signups: 0, conversion: 0, removed: true },
    ];
    const insight = buildInsight(rows)!;
    expect(insight).toMatch(/r\/SaaS/);
    expect(insight).toMatch(/skip/i);
  });
});
