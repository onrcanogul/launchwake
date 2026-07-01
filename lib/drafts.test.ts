import { describe, it, expect } from "vitest";
import { buildDraftPrompt, heuristicDraft, type DraftContext } from "./drafts";

const base: DraftContext = {
  project: {
    name: "Hookline",
    description: "webhook testing tool",
    url: "https://hookline.dev",
  },
  ship: {
    type: "FEATURE",
    title: "Slack alerts for failed webhooks",
    summary: "Know the second an endpoint fails.",
  },
  channel: {
    name: "Hacker News — Show HN",
    platform: "HACKERNEWS",
    rules: "Lead with the build story. No marketing tone.",
  },
  ruleNote: "Frame it problem-first, no pitch.",
};

describe("buildDraftPrompt", () => {
  it("includes platform style, product and the safe way in", () => {
    const { system, prompt } = buildDraftPrompt(base);
    expect(system).toMatch(/posts it themselves/i);
    expect(prompt).toMatch(/Show HN format/i);
    expect(prompt).toContain("Hookline");
    expect(prompt).toContain("Frame it problem-first");
  });
});

describe("heuristicDraft", () => {
  it("produces a Show HN draft with a safety note", () => {
    const d = heuristicDraft(base);
    expect(d.body).toMatch(/^Show HN:/);
    expect(d.body).toContain("Hookline");
    expect((d.safetyNote ?? "").length).toBeGreaterThan(0);
  });

  it("produces an X thread with numbered tweets", () => {
    const d = heuristicDraft({
      ...base,
      channel: { name: "X", platform: "X", rules: null },
    });
    expect(d.body).toContain("1/");
    expect(d.body).toContain("https://hookline.dev");
  });
});
