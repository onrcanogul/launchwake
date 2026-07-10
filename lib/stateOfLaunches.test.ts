import { describe, it, expect } from "vitest";
import {
  buildStateOfLaunches,
  buildPublicBenchmarkBoard,
  stateOfLaunchesOgStats,
  MIN_SAMPLE_POSTS,
  MIN_CONVERSION_CLICKS,
  type StatRow,
  type PublicBenchRow,
} from "./stateOfLaunches";
import { MIN_PUBLIC_SAMPLE } from "./benchmarks";

function row(over: Partial<StatRow> = {}): StatRow {
  return {
    channelName: "Show HN",
    platform: "HACKERNEWS",
    banRisk: "LOW",
    bestTime: "Tue–Thu 8am ET",
    productTag: "devtools-backend",
    posts: 10,
    clicks: 300,
    signups: 30,
    removals: 0,
    ...over,
  };
}

describe("buildStateOfLaunches", () => {
  it("returns an empty report with no data", () => {
    const r = buildStateOfLaunches([]);
    expect(r.hasData).toBe(false);
    expect(r.topChannels).toHaveLength(0);
    expect(r.totals.launches).toBe(0);
    expect(r.totals.conversion).toBe(0);
  });

  it("suppresses channels below the minimum sample (privacy gate)", () => {
    const r = buildStateOfLaunches([
      row({ channelName: "Tiny", posts: MIN_SAMPLE_POSTS - 1, clicks: 5, signups: 5 }),
    ]);
    expect(r.hasData).toBe(false);
    expect(r.topChannels).toHaveLength(0);
    // The suppressed channel must not leak into the totals either.
    expect(r.totals.signups).toBe(0);
    expect(r.totals.channelsRanked).toBe(0);
  });

  it("aggregates a channel across category buckets before gating", () => {
    // Two buckets, each under the gate, but together they clear it.
    const r = buildStateOfLaunches([
      row({ productTag: "devtools", posts: 3, clicks: 60, signups: 6 }),
      row({ productTag: "saas", posts: 3, clicks: 40, signups: 4 }),
    ]);
    expect(r.topChannels).toHaveLength(1);
    const c = r.topChannels[0];
    expect(c.posts).toBe(6);
    expect(c.signups).toBe(10);
    expect(c.clicks).toBe(100);
    expect(c.conversion).toBeCloseTo(0.1);
  });

  it("ranks the overall leaderboard by signups", () => {
    const r = buildStateOfLaunches([
      row({ channelName: "A", signups: 12 }),
      row({ channelName: "B", signups: 40 }),
      row({ channelName: "C", signups: 25 }),
    ]);
    expect(r.topChannels.map((c) => c.name)).toEqual(["B", "C", "A"]);
    expect(r.totals.channelsRanked).toBe(3);
  });

  it("picks best converters only above the click threshold", () => {
    const r = buildStateOfLaunches([
      // High conversion but too little traffic to trust.
      row({ channelName: "Lucky", clicks: MIN_CONVERSION_CLICKS - 1, signups: 10 }),
      // Enough traffic — 10% conversion.
      row({ channelName: "Steady", clicks: 200, signups: 20 }),
      // Enough traffic — 20% conversion, should rank first.
      row({ channelName: "Sharp", clicks: 100, signups: 20 }),
    ]);
    expect(r.bestConverters.map((c) => c.name)).toEqual(["Sharp", "Steady"]);
    expect(r.bestConverters[0].conversion).toBeCloseTo(0.2);
  });

  it("breaks results down by category with per-category winners", () => {
    const r = buildStateOfLaunches([
      row({ channelName: "HN", productTag: "devtools-backend", signups: 30 }),
      row({ channelName: "r/webdev", productTag: "webdev", signups: 18 }),
      row({ channelName: "r/node", productTag: "devtools-node", signups: 12 }),
    ]);
    // devtools has more signups (30+12) than webdev (18) → listed first.
    expect(r.categories.map((c) => c.tag)).toEqual(["devtools", "webdev"]);
    const devtools = r.categories[0];
    expect(devtools.label).toBe("dev-tools");
    expect(devtools.topChannels[0].name).toBe("HN");
    expect(devtools.signups).toBe(42);
  });

  it("computes ban rate by platform, worst first", () => {
    const r = buildStateOfLaunches([
      row({ channelName: "HN", platform: "HACKERNEWS", posts: 20, removals: 1 }),
      row({ channelName: "r/x", platform: "REDDIT", posts: 20, removals: 8 }),
    ]);
    expect(r.banRates[0].platform).toBe("REDDIT");
    expect(r.banRates[0].removalRate).toBeCloseTo(0.4);
    expect(r.banRates[1].platform).toBe("HACKERNEWS");
  });

  it("ranks best-time windows by the signups they drove", () => {
    const r = buildStateOfLaunches([
      row({ channelName: "HN", bestTime: "Tue–Thu 8am ET", signups: 30 }),
      row({ channelName: "PH", bestTime: "12:01am PT", signups: 50 }),
      row({ channelName: "r/x", bestTime: "Tue–Thu 8am ET", signups: 10 }),
    ]);
    expect(r.bestTimes[0].window).toBe("12:01am PT");
    // Two channels share the 8am window → grouped together.
    const morning = r.bestTimes.find((t) => t.window === "Tue–Thu 8am ET")!;
    expect(morning.channels).toEqual(["HN", "r/x"]);
    expect(morning.signups).toBe(40);
  });

  it("caps the overall leaderboard at 10 channels", () => {
    const rows: StatRow[] = Array.from({ length: 15 }, (_, i) =>
      row({ channelName: `ch-${i}`, signups: i }),
    );
    expect(buildStateOfLaunches(rows).topChannels).toHaveLength(10);
  });
});

describe("stateOfLaunchesOgStats", () => {
  it("summarizes the headline numbers", () => {
    const r = buildStateOfLaunches([row({ posts: 10, clicks: 300, signups: 30 })]);
    const stats = stateOfLaunchesOgStats(r);
    expect(stats.map((s) => s.label)).toEqual(["launches", "signups tracked", "channels"]);
    expect(stats[1].value).toBe("30");
  });
});

describe("buildPublicBenchmarkBoard", () => {
  function bench(over: Partial<PublicBenchRow> = {}): PublicBenchRow {
    return {
      channelName: "Hacker News — Show HN",
      platform: "HACKERNEWS",
      productTag: "devtools-backend",
      publicSample: 30,
      medianUpvotes: 42,
      ...over,
    };
  }

  it("is empty with no rows", () => {
    expect(buildPublicBenchmarkBoard([]).hasData).toBe(false);
  });

  it("gates rows below the public sample floor", () => {
    const board = buildPublicBenchmarkBoard([
      bench({ publicSample: MIN_PUBLIC_SAMPLE - 1 }),
    ]);
    expect(board.hasData).toBe(false);
  });

  it("groups by leading category segment and labels it", () => {
    const board = buildPublicBenchmarkBoard([
      bench({ productTag: "devtools-backend", channelName: "Show HN", medianUpvotes: 42 }),
      bench({ productTag: "saas", channelName: "Product Hunt", platform: "PRODUCTHUNT", medianUpvotes: 80 }),
    ]);
    expect(board.categories.map((c) => c.tag).sort()).toEqual(["devtools", "saas"]);
    const saas = board.categories.find((c) => c.tag === "saas")!;
    expect(saas.label).toBe("SaaS");
    expect(saas.channels[0].name).toBe("Product Hunt");
  });

  it("keeps the strongest median for a channel seen under multiple tags", () => {
    const board = buildPublicBenchmarkBoard([
      bench({ productTag: "devtools", channelName: "Show HN", medianUpvotes: 30 }),
      bench({ productTag: "devtools-backend", channelName: "Show HN", medianUpvotes: 55 }),
    ]);
    const devtools = board.categories.find((c) => c.tag === "devtools")!;
    expect(devtools.channels).toHaveLength(1);
    expect(devtools.channels[0].medianUpvotes).toBe(55);
  });

  it("orders categories by their strongest channel median", () => {
    const board = buildPublicBenchmarkBoard([
      bench({ productTag: "webdev", channelName: "Show HN", medianUpvotes: 20 }),
      bench({ productTag: "ai", channelName: "Show HN", medianUpvotes: 90 }),
    ]);
    expect(board.categories[0].tag).toBe("ai");
  });
});
