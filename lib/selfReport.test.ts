import { describe, expect, it } from "vitest";
import {
  SELF_REPORT_OPTIONS,
  normalizeSource,
  rollupSelfReports,
  buildSelfReportInsight,
  optionForSource,
  sourcePlatform,
  isKnownSource,
  type SelfReportRow,
} from "./selfReport";

describe("SELF_REPORT_OPTIONS", () => {
  it("has unique, stable, url-safe keys and includes the 'other' catch-all", () => {
    const values = SELF_REPORT_OPTIONS.map((o) => o.value);
    expect(new Set(values).size).toBe(values.length);
    for (const v of values) expect(v).toMatch(/^[a-z_]+$/);
    expect(values).toContain("other");
  });

  it("every dark-social source (no platform) is a real value; every platform-backed source resolves", () => {
    for (const o of SELF_REPORT_OPTIONS) {
      expect(sourcePlatform(o.value)).toBe(o.platform);
    }
  });
});

describe("normalizeSource", () => {
  it("passes through known keys sent by our own form/snippet", () => {
    expect(normalizeSource("hackernews")).toEqual({ source: "hackernews", platform: "HACKERNEWS" });
    expect(normalizeSource("word_of_mouth")).toEqual({ source: "word_of_mouth", platform: null });
  });

  it("is case-insensitive and trims", () => {
    expect(normalizeSource("  Reddit  ").source).toBe("reddit");
  });

  it("fuzzy-maps customer free text into the shared taxonomy", () => {
    expect(normalizeSource("Twitter").source).toBe("x");
    expect(normalizeSource("saw it on HN").source).toBe("hackernews");
    expect(normalizeSource("Product Hunt").source).toBe("producthunt");
    expect(normalizeSource("a friend recommended it").source).toBe("word_of_mouth");
    expect(normalizeSource("Googled it").source).toBe("search");
    expect(normalizeSource("ChatGPT told me").source).toBe("ai");
    expect(normalizeSource("in a Discord").source).toBe("community");
    expect(normalizeSource("r/webdev").source).toBe("reddit");
  });

  it("keeps dark-social sources platform-less so they can't be reconciled against a link", () => {
    expect(normalizeSource("a podcast").platform).toBeNull();
    expect(normalizeSource("word of mouth").platform).toBeNull();
  });

  it("falls back to 'other' for unrecognized text", () => {
    expect(normalizeSource("skywriting over the office")).toEqual({ source: "other", platform: null });
    expect(normalizeSource("")).toEqual({ source: "other", platform: null });
  });
});

describe("optionForSource / isKnownSource", () => {
  it("resolves the 'other' option for unknown sources", () => {
    expect(isKnownSource("nope")).toBe(false);
    expect(optionForSource("nope").value).toBe("other");
    expect(isKnownSource("reddit")).toBe(true);
  });
});

describe("rollupSelfReports", () => {
  const rows: SelfReportRow[] = [
    // dark social (no ref)
    { source: "word_of_mouth", hasRef: false, linkPlatform: null },
    { source: "word_of_mouth", hasRef: false, linkPlatform: null },
    { source: "podcast", hasRef: false, linkPlatform: null },
    // tracked, self-report AGREES with the link platform
    { source: "x", hasRef: true, linkPlatform: "X" },
    // tracked, self-report DISAGREES with the link platform (the whole point)
    { source: "word_of_mouth", hasRef: true, linkPlatform: "X" }, // wom has no platform → not reconciled
    { source: "reddit", hasRef: true, linkPlatform: "X" }, // reddit(REDDIT) vs link X → disagree
  ];
  const r = rollupSelfReports(rows);

  it("counts totals and the dark-social slice", () => {
    expect(r.total).toBe(6);
    expect(r.darkSocialCount).toBe(3);
    expect(r.darkSocialShare).toBeCloseTo(0.5);
    expect(r.trackedCount).toBe(3);
  });

  it("ranks sources by count", () => {
    expect(r.bySource[0]).toMatchObject({ source: "word_of_mouth", count: 3 });
    expect(r.bySource[0].label).toBe("A friend or colleague");
  });

  it("surfaces the top dark-social source", () => {
    expect(r.topDarkSource).toMatchObject({ source: "word_of_mouth", count: 2 });
  });

  it("reconciles only rows where both platforms are known, and counts divergence", () => {
    // reconciled: the x→X (agree) and reddit→X (disagree). The wom→X row is
    // excluded because word_of_mouth has no platform.
    expect(r.reconciledCount).toBe(2);
    expect(r.agreeCount).toBe(1);
    expect(r.disagreeCount).toBe(1);
    expect(r.divergenceShare).toBeCloseTo(0.5);
  });

  it("handles an empty set without dividing by zero", () => {
    const e = rollupSelfReports([]);
    expect(e.total).toBe(0);
    expect(e.darkSocialShare).toBe(0);
    expect(e.divergenceShare).toBe(0);
    expect(e.topDarkSource).toBeNull();
  });
});

describe("buildSelfReportInsight", () => {
  it("returns null below the data threshold", () => {
    expect(buildSelfReportInsight(rollupSelfReports([{ source: "x", hasRef: false, linkPlatform: null }]))).toBeNull();
  });

  it("leads with the dark-social reveal", () => {
    const rows: SelfReportRow[] = [
      { source: "podcast", hasRef: false, linkPlatform: null },
      { source: "podcast", hasRef: false, linkPlatform: null },
      { source: "word_of_mouth", hasRef: false, linkPlatform: null },
    ];
    const insight = buildSelfReportInsight(rollupSelfReports(rows));
    expect(insight).toContain("no tracked link ever saw");
    expect(insight).toContain("direct");
  });

  it("reports link-vs-reality divergence when there's enough reconciled data", () => {
    const rows: SelfReportRow[] = [
      { source: "reddit", hasRef: true, linkPlatform: "X" },
      { source: "reddit", hasRef: true, linkPlatform: "X" },
      { source: "hackernews", hasRef: true, linkPlatform: "X" },
    ];
    const insight = buildSelfReportInsight(rollupSelfReports(rows));
    expect(insight).toContain("different channel than the link credited");
  });
});
