import { describe, it, expect } from "vitest";
import {
  generateShortCode,
  slugifyCampaign,
  buildDestUrl,
  buildInsight,
  estimateEffortMinutes,
  formatEffort,
  formatMoney,
  summarizeLiveStats,
  type ResultRow,
  type LivePostInput,
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

describe("ROI helpers", () => {
  it("estimates ~18 min of effort per posted channel", () => {
    expect(estimateEffortMinutes(0)).toBe(0);
    expect(estimateEffortMinutes(7)).toBe(126); // ~2h
  });
  it("formats effort as minutes or hours", () => {
    expect(formatEffort(45)).toBe("45m");
    expect(formatEffort(126)).toBe("2.1h");
    expect(formatEffort(600)).toBe("10h");
  });
  it("formats money from cents with the currency", () => {
    expect(formatMoney(34000, "usd")).toBe("$340");
    expect(formatMoney(4999, "usd")).toBe("$49.99");
    expect(formatMoney(29000, "eur")).toBe("€290");
  });
});

function row(partial: Partial<ResultRow> & { channelName: string }): ResultRow {
  return {
    postId: "p1",
    shipTitle: "beta",
    trackedUrl: null,
    postUrl: null,
    clicks: 0,
    signups: 0,
    conversion: 0,
    revenueCents: 0,
    recurringCents: 0,
    removed: false,
    coaching: null,
    ...partial,
  };
}

describe("buildInsight", () => {
  it("returns null with no data", () => {
    expect(buildInsight([])).toBeNull();
  });
  it("recommends doubling down on the best converter", () => {
    const insight = buildInsight([
      row({ channelName: "Hacker News", clicks: 100, signups: 5, conversion: 0.05 }),
      row({ channelName: "X", clicks: 100, signups: 2, conversion: 0.02 }),
    ])!;
    expect(insight).toMatch(/Hacker News/);
    expect(insight).toMatch(/double down/i);
  });
  it("flags a removed post when nothing converts", () => {
    const insight = buildInsight([
      row({ channelName: "r/SaaS", clicks: 10, removed: true }),
    ])!;
    expect(insight).toMatch(/r\/SaaS/);
    expect(insight).toMatch(/skip/i);
  });
  it("leads with revenue when a channel earned money", () => {
    const insight = buildInsight([
      row({ channelName: "Hacker News", clicks: 100, signups: 8, conversion: 0.08 }),
      row({ channelName: "Product Hunt", clicks: 40, signups: 3, revenueCents: 34000, recurringCents: 29000 }),
    ])!;
    // Revenue trumps raw signup conversion for the headline.
    expect(insight).toMatch(/Product Hunt/);
    expect(insight).toMatch(/\$340/);
    expect(insight).toMatch(/recurring/i);
  });
});

describe("summarizeLiveStats", () => {
  const t = (s: string) => new Date(s);

  it("reports nothing tracked before any tracked link exists", () => {
    const s = summarizeLiveStats([
      { channelName: "r/webdev", hasTrackedLink: false, events: [] },
    ]);
    expect(s.postsTracked).toBe(0);
    expect(s.tracking).toBe(false);
    expect(s.channels).toEqual([]);
  });

  it("arms tracking (postsTracked) before the first event fires", () => {
    const s = summarizeLiveStats([
      { channelName: "Show HN", hasTrackedLink: true, events: [] },
      { channelName: "r/webdev", hasTrackedLink: true, events: [] },
    ]);
    expect(s.postsTracked).toBe(2);
    expect(s.tracking).toBe(false);
    expect(s.totalClicks).toBe(0);
    expect(s.lastEventAt).toBeNull();
  });

  it("aggregates clicks/signups per channel and flips tracking on", () => {
    const posts: LivePostInput[] = [
      {
        channelName: "Show HN",
        hasTrackedLink: true,
        events: [
          { type: "CLICK", createdAt: t("2026-07-04T10:00:00Z") },
          { type: "CLICK", createdAt: t("2026-07-04T10:05:00Z") },
          { type: "SIGNUP", createdAt: t("2026-07-04T10:06:00Z") },
        ],
      },
      {
        channelName: "r/webdev",
        hasTrackedLink: true,
        events: [{ type: "CLICK", createdAt: t("2026-07-04T09:00:00Z") }],
      },
    ];
    const s = summarizeLiveStats(posts);
    expect(s.tracking).toBe(true);
    expect(s.totalClicks).toBe(3);
    expect(s.totalSignups).toBe(1);
    // Show HN (has a signup) sorts before r/webdev.
    expect(s.channels[0]).toEqual({ name: "Show HN", clicks: 2, signups: 1 });
    expect(s.channels[1]).toEqual({ name: "r/webdev", clicks: 1, signups: 0 });
    expect(s.lastEventAt).toEqual(t("2026-07-04T10:06:00Z"));
  });

  it("ignores REVENUE events for the click/signup view", () => {
    const s = summarizeLiveStats([
      {
        channelName: "Product Hunt",
        hasTrackedLink: true,
        events: [
          { type: "CLICK", createdAt: t("2026-07-04T10:00:00Z") },
          { type: "REVENUE", createdAt: t("2026-07-04T11:00:00Z") },
        ],
      },
    ]);
    expect(s.totalClicks).toBe(1);
    expect(s.totalSignups).toBe(0);
    // lastEventAt tracks clicks/signups only, not the later revenue event.
    expect(s.lastEventAt).toEqual(t("2026-07-04T10:00:00Z"));
  });
});
