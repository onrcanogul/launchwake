import { describe, it, expect } from "vitest";
import {
  median,
  aggregateFirstParty,
  benchmarkDisplay,
  type PostRecord,
} from "./benchmarks";

describe("median", () => {
  it("returns the middle of an odd-length set", () => {
    expect(median([3, 1, 2])).toBe(2);
  });
  it("averages the two middles of an even-length set (rounded)", () => {
    expect(median([1, 2, 3, 4])).toBe(3); // (2+3)/2 = 2.5 → 3
    expect(median([10, 20])).toBe(15);
  });
  it("is 0 for an empty set", () => {
    expect(median([])).toBe(0);
  });
});

describe("aggregateFirstParty", () => {
  const posts: PostRecord[] = [
    { productTag: "devtools", channelId: "hn", signups: 40, clicks: 300 },
    { productTag: "devtools", channelId: "hn", signups: 34, clicks: 200 },
    { productTag: "devtools", channelId: "hn", signups: 10, clicks: 100 },
    { productTag: "devtools", channelId: "r-saas", signups: 6, clicks: 120 },
    { productTag: "saas", channelId: "hn", signups: 2, clicks: 50 },
  ];

  it("groups by (category, channel) and computes median + conversion", () => {
    const agg = aggregateFirstParty(posts);
    const hn = agg.find((a) => a.productTag === "devtools" && a.channelId === "hn")!;
    expect(hn.sampleSize).toBe(3);
    expect(hn.medianSignups).toBe(34); // median of [40,34,10]
    expect(hn.meanSignups).toBeCloseTo(28); // 84/3
    // total signups 84 / total clicks 600 = 14%
    expect(hn.conversionPct).toBeCloseTo(14);
  });

  it("keeps categories and channels separate", () => {
    const agg = aggregateFirstParty(posts);
    expect(agg.find((a) => a.productTag === "saas" && a.channelId === "hn")?.medianSignups).toBe(2);
    expect(agg.find((a) => a.channelId === "r-saas")?.medianSignups).toBe(6);
  });

  it("handles zero clicks without dividing by zero", () => {
    const agg = aggregateFirstParty([{ productTag: "x", channelId: "c", signups: 3, clicks: 0 }]);
    expect(agg[0].conversionPct).toBe(0);
  });
});

describe("benchmarkDisplay", () => {
  it("shows the first-party signup median once the sample clears the gate", () => {
    const d = benchmarkDisplay(
      {
        channelName: "Show HN",
        sampleSize: 6,
        medianSignups: 34,
        conversionPct: 3.2,
        publicSample: 0,
        medianUpvotes: 0,
        source: "first-party",
      },
      "dev-tools",
    )!;
    expect(d.value).toBe("34 signups");
    expect(d.label).toMatch(/Show HN median for dev-tools/);
    expect(d.sub).toMatch(/3\.2% conversion · 6 launches/);
  });

  it("falls back to public engagement while signup data is thin", () => {
    const d = benchmarkDisplay(
      {
        channelName: "Show HN",
        sampleSize: 1,
        medianSignups: 0,
        conversionPct: 0,
        publicSample: 40,
        medianUpvotes: 42,
        source: "public",
      },
      "dev-tools",
    )!;
    expect(d.value).toBe("42 upvotes");
    expect(d.source).toBe("public");
    expect(d.sub).toMatch(/signup data building/);
  });

  it("returns null when there's neither enough first-party nor public data", () => {
    expect(
      benchmarkDisplay(
        {
          channelName: "Show HN",
          sampleSize: 1,
          medianSignups: 0,
          conversionPct: 0,
          publicSample: 2,
          medianUpvotes: 3,
          source: "public",
        },
        "dev-tools",
      ),
    ).toBeNull();
  });
});
