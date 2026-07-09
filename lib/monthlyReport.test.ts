import { describe, it, expect } from "vitest";
import {
  monthLabel,
  benchmarkComparisonLine,
  suggestedAction,
  shareableLine,
  buildMonthlyReport,
  type MonthlyStats,
} from "./monthlyReport";

function stats(over: Partial<MonthlyStats> = {}): MonthlyStats {
  return {
    clicks: 0,
    signups: 0,
    revenueCents: 0,
    currency: "usd",
    bestChannel: null,
    bestChannelSlug: null,
    bestChannelSignups: 0,
    ...over,
  };
}

describe("monthLabel", () => {
  it("formats a month index + year", () => {
    expect(monthLabel(5, 2026)).toBe("June 2026");
    expect(monthLabel(0, 2026)).toBe("January 2026");
  });
});

describe("benchmarkComparisonLine", () => {
  it("compares actual signups against the category median when data exists", () => {
    const line = benchmarkComparisonLine({
      channelName: "Show HN",
      channelSignups: 12,
      categoryLabel: "dev-tools",
      benchmark: { medianSignups: 34, sampleSize: 9 },
    });
    expect(line).toContain("Show HN: you got 12 signups");
    expect(line).toContain("median dev-tools launch sees 34");
    expect(line).toMatch(/room to grow/);
  });

  it("says you're at or above the median when you beat it", () => {
    const line = benchmarkComparisonLine({
      channelName: "Show HN",
      channelSignups: 40,
      categoryLabel: "dev-tools",
      benchmark: { medianSignups: 34, sampleSize: 9 },
    });
    expect(line).toMatch(/at or above the median/);
  });

  it("falls back to a building note with no channel or too small a sample", () => {
    expect(
      benchmarkComparisonLine({ channelName: null, channelSignups: 0, categoryLabel: "SaaS", benchmark: null }),
    ).toMatch(/still building/);
    expect(
      benchmarkComparisonLine({
        channelName: "r/SaaS",
        channelSignups: 3,
        categoryLabel: "SaaS",
        benchmark: { medianSignups: 5, sampleSize: 1 },
      }),
    ).toMatch(/still building/);
  });
});

describe("suggestedAction", () => {
  it("leads with revenue when there is any", () => {
    expect(suggestedAction(stats({ revenueCents: 5000, bestChannel: "Show HN" }))).toMatch(
      /Double down on Show HN/,
    );
  });
  it("recommends the best channel when there's no revenue", () => {
    expect(suggestedAction(stats({ bestChannel: "r/webdev" }))).toMatch(/Do more of r\/webdev/);
  });
  it("flags a pixel gap on clicks-but-no-signups", () => {
    expect(suggestedAction(stats({ clicks: 40, signups: 0 }))).toMatch(/tracking pixel/);
  });
  it("falls back to ship-and-distribute on an empty month", () => {
    expect(suggestedAction(stats())).toMatch(/Ship something and distribute/);
  });
});

describe("shareableLine", () => {
  it("is a copy-paste build-in-public one-liner with revenue + best channel", () => {
    const line = shareableLine({
      projectName: "Hookline",
      monthLabel: "June 2026",
      stats: stats({ clicks: 340, signups: 41, revenueCents: 34000, bestChannel: "Show HN" }),
    });
    expect(line).toBe(
      "Hookline — June 2026: 41 signups from 340 clicks, $340 in attributed revenue. Best channel: Show HN. Tracked with LaunchWake.",
    );
  });
  it("singularizes one signup/click and omits revenue when zero", () => {
    const line = shareableLine({
      projectName: "Hookline",
      monthLabel: "June 2026",
      stats: stats({ clicks: 1, signups: 1 }),
    });
    expect(line).toContain("1 signup from 1 click.");
    expect(line).not.toContain("revenue");
  });
});

describe("buildMonthlyReport", () => {
  const email = buildMonthlyReport({
    projectName: "Hookline",
    monthLabel: "June 2026",
    appUrl: "https://launchwake.com",
    stats: stats({ clicks: 340, signups: 41, revenueCents: 34000, bestChannel: "Show HN" }),
    benchmarkLine: "Show HN: you got 41 signups last month; the median dev-tools launch sees 34.",
    unsubscribeUrl: "https://launchwake.com/api/email/unsubscribe?u=u1&t=tok",
  });

  it("titles the subject with the project and month", () => {
    expect(email.subject).toBe("Hookline: your June 2026 distribution report");
  });

  it("carries every section, the numbers, the benchmark, and a shareable block", () => {
    expect(email.text).toContain("LAST MONTH");
    expect(email.text).toContain("340 clicks · 41 signups");
    expect(email.text).toContain("$340 revenue");
    expect(email.text).toContain("Best channel: Show HN");
    expect(email.text).toContain("BENCHMARK");
    expect(email.text).toContain("median dev-tools launch sees 34");
    expect(email.text).toContain("NEXT MONTH");
    expect(email.text).toContain("SHAREABLE");
    expect(email.text).toContain("Tracked with LaunchWake.");
    expect(email.text).toContain("https://launchwake.com/app/results");
  });

  it("carries the unsubscribe footer", () => {
    expect(email.text).toContain("https://launchwake.com/api/email/unsubscribe?u=u1&t=tok");
  });
});
