import { describe, it, expect, vi } from "vitest";
import {
  median,
  aggregateFirstParty,
  benchmarkDisplay,
  checkerBenchmarkLine,
  coverageTargets,
  publicSource,
  COVERAGE_BUCKETS,
  type PostRecord,
  type CatalogChannel,
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

// A ready-to-tweak benchmark view for the display tests.
function view(over: Partial<Parameters<typeof benchmarkDisplay>[0]> = {}) {
  return {
    channelName: "Show HN",
    platform: "HACKERNEWS",
    sampleSize: 0,
    medianSignups: 0,
    conversionPct: 0,
    publicSample: 0,
    medianUpvotes: 0,
    source: "public" as const,
    ...over,
  };
}

describe("benchmarkDisplay — source/label selection", () => {
  it("shows the first-party signup median once the sample clears the gate", () => {
    const d = benchmarkDisplay(
      view({ sampleSize: 6, medianSignups: 34, conversionPct: 3.2, source: "first-party" }),
      "dev-tools",
    )!;
    expect(d.value).toBe("34 signups");
    expect(d.source).toBe("first-party");
    expect(d.label).toMatch(/Show HN median for dev-tools/);
    expect(d.sub).toMatch(/3\.2% conversion · 6 launches/);
  });

  it("keeps the blended label when first-party AND public both exist", () => {
    const d = benchmarkDisplay(
      view({
        sampleSize: 6,
        medianSignups: 34,
        conversionPct: 3.2,
        publicSample: 40,
        medianUpvotes: 42,
        source: "blended",
      }),
      "dev-tools",
    )!;
    // First-party wins the value, but the row stays honestly labelled "blended".
    expect(d.value).toBe("34 signups");
    expect(d.source).toBe("blended");
  });

  it("falls back to public engagement while signup data is thin — HN label", () => {
    const d = benchmarkDisplay(
      view({ sampleSize: 1, publicSample: 40, medianUpvotes: 42, platform: "HACKERNEWS" }),
      "dev-tools",
    )!;
    expect(d.value).toBe("42 upvotes");
    expect(d.source).toBe("public");
    expect(d.sub).toMatch(/Public data \(HN\), last 90 days/);
    expect(d.sub).toMatch(/signup data building/);
  });

  it("labels a Product Hunt public row as PH, last 90 days", () => {
    const d = benchmarkDisplay(
      view({ publicSample: 20, medianUpvotes: 88, platform: "PRODUCTHUNT" }),
      "SaaS",
    )!;
    expect(d.sub).toMatch(/Public data \(PH\), last 90 days/);
  });

  it("labels a Reddit public row with its narrower window", () => {
    const d = benchmarkDisplay(
      view({ publicSample: 20, medianUpvotes: 15, platform: "REDDIT" }),
      "web-dev",
    )!;
    expect(d.sub).toMatch(/Public data \(Reddit\), past 30 days/);
  });

  it("returns null when there's neither enough first-party nor public data", () => {
    expect(
      benchmarkDisplay(view({ sampleSize: 1, publicSample: 2, medianUpvotes: 3 }), "dev-tools"),
    ).toBeNull();
  });
});

describe("publicSource", () => {
  it("names each source honestly with its window", () => {
    expect(publicSource("HACKERNEWS")).toMatchObject({ abbrev: "HN", window: "last 90 days" });
    expect(publicSource("PRODUCTHUNT")).toMatchObject({ abbrev: "PH", window: "last 90 days" });
    expect(publicSource("REDDIT")).toMatchObject({ abbrev: "Reddit", window: "past 30 days" });
    expect(publicSource("SLACK").abbrev).toBe("public");
  });
});

describe("checkerBenchmarkLine", () => {
  it("formats the category teaser line", () => {
    expect(checkerBenchmarkLine({ medianUpvotes: 42, publicSample: 30 }, "dev-tools")).toBe(
      "Public data: dev-tools Show HN posts got a median of 42 points in the last 90 days",
    );
  });
  it("singularizes one point", () => {
    expect(checkerBenchmarkLine({ medianUpvotes: 1, publicSample: 8 }, "SaaS")).toMatch(
      /median of 1 point in the last 90 days/,
    );
  });
  it("returns null below the sample floor or with no engagement", () => {
    expect(checkerBenchmarkLine({ medianUpvotes: 42, publicSample: 2 }, "dev-tools")).toBeNull();
    expect(checkerBenchmarkLine({ medianUpvotes: 0, publicSample: 30 }, "dev-tools")).toBeNull();
    expect(checkerBenchmarkLine(null, "dev-tools")).toBeNull();
  });
});

describe("coverageTargets — every bucket gets public coverage", () => {
  const catalog: CatalogChannel[] = [
    {
      id: "c-hnshow",
      slug: "hn-show",
      platform: "HACKERNEWS",
      url: "https://news.ycombinator.com/show",
      tags: ["devtools", "infra", "launch", "opensource", "backend"],
      defaultBanRisk: "LOW",
    },
    {
      id: "c-ph",
      slug: "product-hunt",
      platform: "PRODUCTHUNT",
      url: "https://www.producthunt.com",
      tags: ["launch", "product", "saas", "devtools", "b2b"],
      defaultBanRisk: "LOW",
    },
    // Non-fetchable platforms — must never become bootstrap targets.
    {
      id: "c-devto",
      slug: "dev-to",
      platform: "DEVTO",
      url: "https://dev.to",
      tags: ["webdev", "javascript", "frontend"],
      defaultBanRisk: "LOW",
    },
    {
      id: "c-rwebdev",
      slug: "r-webdev",
      platform: "REDDIT",
      url: "https://www.reddit.com/r/webdev",
      tags: ["webdev", "frontend", "javascript"],
      defaultBanRisk: "MEDIUM",
    },
  ];

  const targets = coverageTargets(catalog);

  it("covers every COVERAGE_BUCKETS category", () => {
    for (const bucket of COVERAGE_BUCKETS) {
      expect(targets.some((t) => t.productTag === bucket)).toBe(true);
    }
  });

  it("guarantees Show HN (the universal launch venue) in every bucket", () => {
    for (const bucket of COVERAGE_BUCKETS) {
      const hn = targets.filter((t) => t.productTag === bucket && t.channelId === "c-hnshow");
      expect(hn.length).toBe(1);
    }
  });

  it("only ever targets fetchable launch platforms (HN/PH)", () => {
    for (const t of targets) {
      expect(["HACKERNEWS", "PRODUCTHUNT"]).toContain(t.platform);
    }
    expect(targets.some((t) => t.channelId === "c-devto")).toBe(false);
    expect(targets.some((t) => t.channelId === "c-rwebdev")).toBe(false);
  });

  it("adds a tag-matched venue (Product Hunt for saas) alongside Show HN", () => {
    const saas = targets.filter((t) => t.productTag === "saas").map((t) => t.channelId);
    expect(saas).toContain("c-hnshow");
    expect(saas).toContain("c-ph");
  });
});

describe("request-path helpers never touch the network", () => {
  it("pure display + coverage helpers make zero fetch calls", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    benchmarkDisplay(view({ publicSample: 40, medianUpvotes: 42 }), "dev-tools");
    benchmarkDisplay(view({ sampleSize: 6, medianSignups: 34, source: "first-party" }), "dev-tools");
    checkerBenchmarkLine({ medianUpvotes: 42, publicSample: 30 }, "dev-tools");
    publicSource("HACKERNEWS");
    coverageTargets([
      {
        id: "c-hnshow",
        slug: "hn-show",
        platform: "HACKERNEWS",
        url: null,
        tags: ["launch"],
        defaultBanRisk: "LOW",
      },
    ]);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
