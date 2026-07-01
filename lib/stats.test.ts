import { describe, it, expect } from "vitest";
import { productTagFor, outcomeEvidence, bucketLabel } from "./stats";

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

describe("bucketLabel", () => {
  it("humanises the product bucket", () => {
    expect(bucketLabel("devtools-webdev")).toBe("dev-tools");
    expect(bucketLabel("saas-b2b")).toBe("SaaS");
    expect(bucketLabel("general")).toBe("products like yours");
  });
});

describe("outcomeEvidence", () => {
  it("is empty without a signal", () => {
    expect(outcomeEvidence(undefined, "devtools")).toEqual({ boost: 0, note: null });
    expect(
      outcomeEvidence({ posts: 0, clicks: 0, signups: 0, removals: 0 }, "devtools"),
    ).toEqual({ boost: 0, note: null });
  });

  it("boosts converters and states the evidence for the bucket", () => {
    const ev = outcomeEvidence(
      { posts: 5, clicks: 100, signups: 4, removals: 0 },
      "devtools-webdev",
    );
    expect(ev.boost).toBeGreaterThan(0);
    expect(ev.note).toMatch(/Proven/);
    expect(ev.note).toMatch(/dev-tools/);
    expect(ev.note).toMatch(/4\.0% conv/);
  });

  it("ramps boost with sample size (low sample → smaller boost)", () => {
    const low = outcomeEvidence({ posts: 1, clicks: 20, signups: 1, removals: 0 }, "saas");
    const high = outcomeEvidence({ posts: 5, clicks: 100, signups: 5, removals: 0 }, "saas");
    expect(high.boost).toBeGreaterThan(low.boost);
  });

  it("penalises and flags removals", () => {
    const ev = outcomeEvidence(
      { posts: 2, clicks: 10, signups: 0, removals: 2 },
      "saas",
    );
    expect(ev.boost).toBeLessThan(0);
    expect(ev.note).toMatch(/removals?/);
    expect(ev.note).toMatch(/post carefully/);
  });
});
