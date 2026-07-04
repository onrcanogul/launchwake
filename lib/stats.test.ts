import { describe, it, expect } from "vitest";
import {
  productTagFor,
  outcomeEvidence,
  outcomeFactLine,
  projectOutcomeFactLine,
  bucketLabel,
} from "./stats";

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

  it("downranks channels that got traffic but zero signups", () => {
    const ev = outcomeEvidence(
      { posts: 3, clicks: 40, signups: 0, removals: 0 },
      "devtools",
    );
    expect(ev.boost).toBeLessThan(0);
    expect(ev.note).toMatch(/40 clicks but 0 signups/);
    expect(ev.note).toMatch(/didn't convert/);
  });

  it("does not penalise a tiny non-converting sample (below the click floor)", () => {
    const ev = outcomeEvidence(
      { posts: 1, clicks: 3, signups: 0, removals: 0 },
      "devtools",
    );
    expect(ev.boost).toBe(0);
    expect(ev.note).toBeNull();
  });
});

describe("outcomeFactLine", () => {
  it("is null without history", () => {
    expect(outcomeFactLine(undefined, "devtools")).toBeNull();
    expect(
      outcomeFactLine({ posts: 0, clicks: 0, signups: 0, removals: 0 }, "devtools"),
    ).toBeNull();
  });

  it("states raw numbers and conversion for the prompt", () => {
    const line = outcomeFactLine(
      { posts: 3, clicks: 40, signups: 0, removals: 0 },
      "devtools-webdev",
    );
    expect(line).toContain("dev-tools");
    expect(line).toContain("3 posts");
    expect(line).toContain("40 clicks");
    expect(line).toContain("0 signups");
    expect(line).toContain("0.0% conversion");
  });

  it("includes removals when present", () => {
    const line = outcomeFactLine(
      { posts: 2, clicks: 20, signups: 1, removals: 1 },
      "saas",
    );
    expect(line).toMatch(/1 removal\b/);
  });
});

describe("projectOutcomeFactLine", () => {
  it("is null without first-party history", () => {
    expect(projectOutcomeFactLine(undefined)).toBeNull();
    expect(
      projectOutcomeFactLine({ posts: 0, clicks: 0, signups: 0, removals: 0 }),
    ).toBeNull();
  });

  it("states the founder's own numbers with conversion", () => {
    expect(
      projectOutcomeFactLine({ posts: 2, clicks: 50, signups: 5, removals: 0 }),
    ).toBe(
      "your own results here: 2 of your posts, 50 clicks, 5 signups, 10.0% conversion",
    );
  });

  it("singularizes and mentions removals", () => {
    expect(
      projectOutcomeFactLine({ posts: 1, clicks: 0, signups: 0, removals: 1 }),
    ).toBe("your own results here: 1 of your post, 0 clicks, 0 signups, 1 removal");
  });
});
