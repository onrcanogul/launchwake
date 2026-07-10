import { describe, it, expect } from "vitest";
import {
  productTagFor,
  outcomeEvidence,
  outcomeFactLine,
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
  it("buckets a consumer mobile app as consumer", () => {
    const tag = productTagFor("A consumer mobile app for iPhone to edit your photos");
    expect(tag).toContain("consumer");
  });
  it("buckets a game as a game/consumer product", () => {
    const tag = productTagFor("A cozy pixel-art indie game about farming");
    expect(tag.split("-")).toContain("game");
  });
  it("does NOT bucket a CLI devtool as consumer (conservative)", () => {
    const tag = productTagFor(
      "A command-line devtool for developers to manage Postgres migrations",
    );
    expect(tag).not.toContain("consumer");
    expect(tag).toContain("devtools");
  });
});

describe("bucketLabel", () => {
  it("humanises the product bucket", () => {
    expect(bucketLabel("devtools-webdev")).toBe("dev-tools");
    expect(bucketLabel("saas-b2b")).toBe("SaaS");
    expect(bucketLabel("consumer-b2c")).toBe("consumer apps");
    expect(bucketLabel("game")).toBe("games");
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
