import { describe, it, expect } from "vitest";
import { productTagFor, outcomeBoost } from "./stats";

describe("productTagFor", () => {
  it("buckets a devtools/backend product", () => {
    const tag = productTagFor(
      "Hookline — a webhook testing tool for developers, an API devtool for backend engineers",
    );
    expect(tag).toContain("devtools");
  });
  it("falls back to general when nothing matches", () => {
    expect(productTagFor("a lovely journal for feelings")).toBe("general");
  });
  it("is deterministic", () => {
    const a = productTagFor("saas b2b analytics tool");
    const b = productTagFor("saas b2b analytics tool");
    expect(a).toBe(b);
  });
});

describe("outcomeBoost", () => {
  it("is zero without a signal", () => {
    expect(outcomeBoost(undefined)).toBe(0);
  });
  it("boosts converters and caps at +10", () => {
    expect(outcomeBoost({ posts: 1, clicks: 10, signups: 3, removals: 0 })).toBe(6);
    expect(outcomeBoost({ posts: 1, clicks: 99, signups: 50, removals: 0 })).toBe(10);
  });
  it("penalises removals", () => {
    expect(outcomeBoost({ posts: 1, clicks: 0, signups: 0, removals: 1 })).toBe(-5);
  });
});
