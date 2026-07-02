import { describe, it, expect } from "vitest";
import { buildCoachPrompt, heuristicCoach, type CoachInput } from "./coach";
import type { SafetyReport } from "./bansafety";

const cleanSafety: SafetyReport = { checks: [], worst: "pass", fails: 0, warns: 0 };
const failSafety: SafetyReport = {
  checks: [
    { level: "fail", label: "Link in title", detail: "Reddit removes posts with a link in the title." },
    { level: "warn", label: "Reads promotional", detail: "Lead with value, mention the tool as a footnote." },
  ],
  worst: "fail",
  fails: 1,
  warns: 1,
};

function input(over: Partial<CoachInput> = {}): CoachInput {
  return {
    channel: { name: "r/SaaS", platform: "REDDIT", rules: "Heavily moderated. No pitches." },
    bestTime: "Tue–Thu 10am ET",
    postText: "Check out my new tool https://x.com",
    postedAtLabel: "Mon 3:00 PM UTC",
    outcome: { clicks: 40, signups: 0, conversion: 0, removed: false },
    safety: cleanSafety,
    ...over,
  };
}

describe("buildCoachPrompt", () => {
  it("grounds the coach in rules, outcome, checks, and the post text", () => {
    const { system, prompt } = buildCoachPrompt(input({ safety: failSafety }));
    expect(system).toMatch(/NEVER invent/i);
    expect(system).toMatch(/actionable fix/i);
    expect(prompt).toContain("r/SaaS");
    expect(prompt).toContain("Heavily moderated");
    expect(prompt).toContain("40 clicks, 0 signups");
    expect(prompt).toContain("Link in title");
    expect(prompt).toContain("Check out my new tool");
  });
});

describe("heuristicCoach", () => {
  it("flags rule failures as high severity and lowers the score", () => {
    const r = heuristicCoach(input({ safety: failSafety }));
    expect(r.playbookScore).toBeLessThan(100);
    expect(r.diagnoses.some((d) => d.severity === "high" && /link in title/i.test(d.title))).toBe(true);
    expect(r.diagnoses.every((d) => d.fix.length > 0)).toBe(true);
  });

  it("diagnoses traffic that didn't convert", () => {
    const r = heuristicCoach(input({ outcome: { clicks: 40, signups: 0, conversion: 0, removed: false } }));
    expect(r.diagnoses.some((d) => /didn't convert|nothing converted/i.test(d.title))).toBe(true);
  });

  it("calls out a removed post", () => {
    const r = heuristicCoach(input({ outcome: { clicks: 5, signups: 0, conversion: 0, removed: true } }));
    expect(r.diagnoses[0].severity).toBe("high");
    expect(r.verdict).toMatch(/removed/i);
    expect(r.playbookScore).toBeLessThan(80);
  });

  it("celebrates a clean converting post", () => {
    const r = heuristicCoach(
      input({ postText: "Show HN: I built X", outcome: { clicks: 100, signups: 6, conversion: 0.06, removed: false } }),
    );
    expect(r.playbookScore).toBe(100);
    expect(r.diagnoses.some((d) => d.severity === "low")).toBe(true);
  });
});
