import { describe, it, expect } from "vitest";
import {
  AUDIENCE_LANGUAGES,
  DEFAULT_AUDIENCE,
  isAudienceLanguage,
  resolveAudience,
  effectiveAudienceCode,
  analysisLanguageRule,
  draftLanguageRule,
} from "./audience";
import { buildAnalysisPrompt, type PlanInput } from "./analysis";
import { buildDraftPrompt, type DraftContext } from "./drafts";
import type { ChannelLike } from "./channels";

describe("audience catalog", () => {
  it("starts with English and has unique codes", () => {
    expect(AUDIENCE_LANGUAGES[0].code).toBe(DEFAULT_AUDIENCE);
    const codes = AUDIENCE_LANGUAGES.map((l) => l.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("isAudienceLanguage narrows only known codes", () => {
    expect(isAudienceLanguage("tr")).toBe(true);
    expect(isAudienceLanguage("en")).toBe(true);
    expect(isAudienceLanguage("xx")).toBe(false);
    expect(isAudienceLanguage("")).toBe(false);
    expect(isAudienceLanguage(null)).toBe(false);
    expect(isAudienceLanguage(undefined)).toBe(false);
  });

  it("resolveAudience falls back to English for unknown/empty codes", () => {
    expect(resolveAudience("tr").englishName).toBe("Turkish");
    expect(resolveAudience("xx").code).toBe("en");
    expect(resolveAudience(null).code).toBe("en");
  });
});

describe("effectiveAudienceCode", () => {
  it("prefers a valid ship override", () => {
    expect(effectiveAudienceCode("tr", "en")).toBe("tr");
  });
  it("falls back to the project default when the ship has no override", () => {
    expect(effectiveAudienceCode(null, "de")).toBe("de");
  });
  it("ignores unknown codes at each level and defaults to English", () => {
    expect(effectiveAudienceCode("zz", "de")).toBe("de");
    expect(effectiveAudienceCode(null, "zz")).toBe("en");
    expect(effectiveAudienceCode(undefined, undefined)).toBe("en");
  });
});

describe("language rules", () => {
  it("are empty for English (no injection when it's the base language)", () => {
    expect(analysisLanguageRule("en")).toBe("");
    expect(draftLanguageRule("en")).toBe("");
  });

  it("name the target language for a non-English audience", () => {
    expect(analysisLanguageRule("tr")).toContain("Turkish");
    expect(draftLanguageRule("tr")).toContain("Turkish");
  });

  it("unknown codes degrade to no injection (treated as English)", () => {
    expect(analysisLanguageRule("zz")).toBe("");
    expect(draftLanguageRule("zz")).toBe("");
  });
});

// The two LLM prompt builders must actually carry the rule so outputs localize.
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
    tags: ["developers"],
  },
];

const planInput: PlanInput = {
  project: { name: "Hookline", description: "webhook tool", url: null, githubRepo: null },
  ship: { type: "FEATURE", title: "Slack alerts", summary: "Know when webhooks fail." },
};

const draftCtx: DraftContext = {
  project: { name: "Hookline", description: "webhook tool", url: "https://hookline.dev" },
  ship: { type: "FEATURE", title: "Slack alerts", summary: "Know when webhooks fail." },
  channel: { name: "Hacker News — Show HN", platform: "HACKERNEWS", rules: "Build story first.", tags: [] },
  ruleNote: "Problem-first, no pitch.",
};

describe("prompt injection", () => {
  it("buildAnalysisPrompt injects the language rule for a Turkish audience", () => {
    const { system } = buildAnalysisPrompt(planInput, candidates, undefined, {
      audienceCode: "tr",
    });
    expect(system).toContain("Turkish");
    expect(system).toContain("TARGET AUDIENCE");
  });

  it("buildAnalysisPrompt stays English-only by default", () => {
    const { system } = buildAnalysisPrompt(planInput, candidates);
    expect(system).not.toContain("TARGET AUDIENCE");
  });

  it("buildDraftPrompt injects the language rule for a Turkish audience", () => {
    const { system } = buildDraftPrompt(draftCtx, "founder", "tr");
    expect(system).toContain("Turkish");
  });

  it("buildDraftPrompt stays English-only by default", () => {
    const { system } = buildDraftPrompt(draftCtx);
    expect(system).not.toContain("not a translation");
  });
});
