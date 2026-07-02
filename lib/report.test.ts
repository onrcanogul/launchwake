import { describe, it, expect } from "vitest";
import {
  newReportToken,
  badgeSvg,
  reportOgStats,
  reportMetaDescription,
  type PublicReport,
} from "./report";
import type { RoiSummary } from "./attribution";

const roi: RoiSummary = {
  posts: 5,
  effortMinutes: 90,
  effortLabel: "1.5h",
  clicks: 340,
  signups: 41,
  revenueCents: 34000,
  recurringCents: 29000,
  currency: "usd",
};

function report(over: Partial<PublicReport> = {}): PublicReport {
  return {
    project: { name: "Hookline", url: "https://hookline.dev" },
    ship: { title: "v1.0", type: "LAUNCH", summary: null, when: new Date(0) },
    channels: [
      { name: "Show HN", platform: "HACKERNEWS", fitScore: 90, banRisk: "LOW", bestTime: null, why: "…", clicks: 200, signups: 30, revenueCents: 34000 },
      { name: "r/node", platform: "REDDIT", fitScore: 80, banRisk: "MEDIUM", bestTime: null, why: "…", clicks: 140, signups: 11, revenueCents: 0 },
    ],
    showRevenue: true,
    totals: { clicks: 340, signups: 41, conversion: 0.12, revenueCents: 34000, mrrCents: 29000 },
    roi,
    topRevenueChannel: { name: "Show HN", revenueCents: 34000 },
    ...over,
  };
}

describe("newReportToken", () => {
  it("is URL-safe and unique across many draws", () => {
    const set = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const t = newReportToken();
      expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(t.length).toBeGreaterThanOrEqual(10);
      set.add(t);
    }
    expect(set.size).toBe(300);
  });
});

describe("badgeSvg", () => {
  it("is an SVG that says Powered by LaunchWake", () => {
    const svg = badgeSvg();
    expect(svg).toMatch(/^<svg/);
    expect(svg).toContain("LaunchWake");
    expect(svg.toLowerCase()).toContain("powered by");
  });
});

describe("reportOgStats / meta", () => {
  it("includes revenue only when shown", () => {
    const withRev = reportOgStats(report());
    expect(withRev.some((s) => s.label === "revenue" && s.value === "$340")).toBe(true);

    const hidden = reportOgStats(
      report({ showRevenue: false, totals: { clicks: 340, signups: 41, conversion: 0.12, revenueCents: null, mrrCents: null } }),
    );
    expect(hidden.some((s) => s.label === "revenue")).toBe(false);
    // channels/clicks/signups still present
    expect(hidden.map((s) => s.label)).toEqual(["channels", "clicks", "signups"]);
  });

  it("builds a shareable meta description", () => {
    const desc = reportMetaDescription(report());
    expect(desc).toContain("Hookline");
    expect(desc).toContain("340 clicks");
    expect(desc).toContain("$340 revenue");
    expect(desc).toContain("LaunchWake");
  });
});
