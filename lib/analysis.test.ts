import { describe, it, expect } from "vitest";
import {
  buildAnalysisPrompt,
  heuristicRank,
  computeBanRisk,
  type PlanInput,
} from "./analysis";
import type { ChannelLike, ScoredChannel } from "./channels";
import type { Channel } from "@prisma/client";

const candidates: ChannelLike[] = [
  {
    id: "1",
    slug: "hn-show",
    name: "Hacker News — Show HN",
    platform: "HACKERNEWS",
    audienceDesc: "developers",
    rules: "Lead with the build story. No marketing tone.",
    defaultBanRisk: "LOW",
    bestTime: "Tue–Thu 8am ET",
    tags: ["developers", "devtools"],
  },
  {
    id: "2",
    slug: "r-saas",
    name: "r/SaaS",
    platform: "REDDIT",
    audienceDesc: "founders",
    rules: "Heavily moderated. Share lessons, not pitches.",
    defaultBanRisk: "HIGH",
    bestTime: "Tue 10am",
    tags: ["saas"],
  },
];

const input: PlanInput = {
  project: {
    name: "Hookline",
    description: "webhook testing tool for developers",
    url: "https://hookline.dev",
    githubRepo: "hookline/api",
  },
  ship: {
    type: "FEATURE",
    title: "Slack alerts for failed webhooks",
    summary: "Know the second an endpoint fails.",
  },
};

describe("buildAnalysisPrompt", () => {
  it("constrains the LLM to provided slugs and includes context", () => {
    const { system, prompt } = buildAnalysisPrompt(input, candidates);
    expect(system).toMatch(/ONLY use channels/i);
    expect(system).toMatch(/NEVER invent/i);
    expect(prompt).toContain("slug=hn-show");
    expect(prompt).toContain("slug=r-saas");
    expect(prompt).toContain("Hookline");
    expect(prompt).toContain("Slack alerts for failed webhooks");
  });

  it("omits the outcome-weighting rule when there is no history", () => {
    const { system, prompt } = buildAnalysisPrompt(input, candidates);
    expect(system).not.toMatch(/past results/i);
    expect(prompt).not.toMatch(/past results/i);
  });

  it("renders the classification reason into context ONLY when short-form candidates are present", () => {
    const reason = "a visual mobile photo editor — a before/after Reel fits";
    const tiktok: ChannelLike = {
      id: "sf",
      slug: "tiktok-app-demo",
      name: "TikTok — App Demo",
      platform: "TIKTOK",
      rules: "Hook in the first 2 seconds. Bio link only.",
      defaultBanRisk: "LOW",
      tags: ["shortform", "mobile-app", "consumer", "visual-demo"],
    };

    // With a short-form candidate → the product read is surfaced + the model is
    // told to ground the format why-line in it.
    const withShortform = buildAnalysisPrompt(input, [tiktok], undefined, {
      classificationReason: reason,
    });
    expect(withShortform.prompt).toContain(`Product read: ${reason}`);
    expect(withShortform.system).toMatch(/Product read/);

    // Without any short-form candidate → the reason is suppressed (nothing to
    // justify), so it never bloats an all-text-channel prompt.
    const withoutShortform = buildAnalysisPrompt(input, candidates, undefined, {
      classificationReason: reason,
    });
    expect(withoutShortform.prompt).not.toContain("Product read:");
    expect(withoutShortform.system).not.toMatch(/Product read/);
  });

  it("injects per-channel past results and the weighting rule when provided", () => {
    const outcomes = new Map<string, string>([
      ["r-saas", "past results for SaaS: 3 posts, 40 clicks, 0 signups, 0.0% conversion"],
    ]);
    const { system, prompt } = buildAnalysisPrompt(input, candidates, outcomes);
    // The channel with history carries its line...
    expect(prompt).toContain(
      "past results: past results for SaaS: 3 posts, 40 clicks, 0 signups",
    );
    // ...the one without history does not.
    const hnBlock = prompt.slice(
      prompt.indexOf("slug=hn-show"),
      prompt.indexOf("slug=r-saas"),
    );
    expect(hnBlock).not.toMatch(/past results/);
    // ...and the model is told to weight it down for clicks-without-signups.
    expect(system).toMatch(/ZERO signups.*LOWER/i);
  });
});

describe("heuristicRank", () => {
  it("ranks every candidate with a bounded fit score and valid slugs", () => {
    const scored: ScoredChannel[] = [
      { channel: candidates[0], score: 20, matchedTags: ["developers", "devtools"] },
      { channel: candidates[1], score: 0, matchedTags: [] },
    ];
    const result = heuristicRank(scored, input);
    expect(result.rankings).toHaveLength(2);
    for (const r of result.rankings) {
      expect(r.fitScore).toBeGreaterThanOrEqual(60);
      expect(r.fitScore).toBeLessThanOrEqual(96);
      expect(["hn-show", "r-saas"]).toContain(r.slug);
      expect(r.why.length).toBeGreaterThan(0);
      expect(r.ruleNote.length).toBeGreaterThan(0);
    }
    // higher overlap → higher fit
    const hn = result.rankings.find((r) => r.slug === "hn-show")!;
    const saas = result.rankings.find((r) => r.slug === "r-saas")!;
    expect(hn.fitScore).toBeGreaterThan(saas.fitScore);
  });

  it("leads a short-form channel with the demo/format angle (and the honest attribution ceiling)", () => {
    // Short-form channels only reach ranking for a visual/consumer product, so the
    // why-line must call out the demo/format angle specifically, not the generic
    // template — the full-plan transparency requirement.
    const tiktok: ChannelLike = {
      id: "sf",
      slug: "tiktok-app-demo",
      name: "TikTok — App Demo",
      platform: "TIKTOK",
      audienceDesc: "consumers discovering apps",
      rules: "Hook in the first 2 seconds. Bio link only.",
      defaultBanRisk: "LOW",
      bestTime: "Evenings",
      tags: ["shortform", "mobile-app", "consumer", "visual-demo"],
    };
    const scored: ScoredChannel[] = [
      { channel: tiktok, score: 30, matchedTags: ["mobile-app", "consumer"] },
    ];
    const why = heuristicRank(scored, input).rankings[0].why;
    expect(why).toMatch(/demo/i);
    expect(why).toMatch(/format/i);
    expect(why).toMatch(/bio.link/i);
    // grounded in the product name
    expect(why).toContain(input.project.name);
  });
});

describe("computeBanRisk", () => {
  const base = { defaultBanRisk: "LOW" } as Channel;
  it("keeps catalog HIGH risk", () => {
    expect(computeBanRisk({ ...base, defaultBanRisk: "HIGH" } as Channel)).toBe(
      "HIGH",
    );
  });
  it("escalates from removals signal", () => {
    expect(computeBanRisk(base, 1)).toBe("MEDIUM");
    expect(computeBanRisk(base, 2)).toBe("HIGH");
  });
  it("defaults to LOW", () => {
    expect(computeBanRisk(base, 0)).toBe("LOW");
  });
});
