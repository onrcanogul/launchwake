import { describe, expect, it } from "vitest";
import {
  SELF_REPORT_OPTIONS,
  normalizeSource,
  rollupSelfReports,
  buildSelfReportInsight,
  optionForSource,
  sourcePlatform,
  platformLabel,
  isKnownSource,
  confidenceFor,
  reconcileAttribution,
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

  it("prefers a named platform over word-of-mouth when both appear", () => {
    // "a friend shared it on reddit" — the actionable channel wins.
    expect(normalizeSource("a friend shared it on reddit").source).toBe("reddit");
    expect(normalizeSource("saw a colleague post it on Hacker News").source).toBe("hackernews");
  });

  it("maps Turkish free-text answers (the survey runs on the customer's site)", () => {
    const cases: Array<[string, string]> = [
      ["Bir arkadaşım tavsiye etti", "word_of_mouth"],
      ["arkadaşımdan duydum", "word_of_mouth"],
      ["bir meslektaşım önerdi", "word_of_mouth"],
      ["kulaktan kulağa duydum", "word_of_mouth"],
      ["Reddit'te gördüm", "reddit"],
      ["Twitter'da denk geldim", "x"],
      ["X'te bir tweet gördüm", "x"],
      ["LinkedIn'de bir gönderi", "linkedin"],
      ["Google'da arattım", "search"],
      ["internette ararken buldum", "search"],
      ["YouTube'da bir video", "youtube"],
      ["bir bülten aracılığıyla", "newsletter"],
      ["bir blog yazısında", "blog"],
      ["Discord sunucusunda", "community"],
      ["açık kaynak GitHub reposu", "github"],
      ["ChatGPT önerdi", "ai"],
      ["yapay zeka asistanı", "ai"],
      ["Product Hunt üzerinden", "producthunt"],
    ];
    for (const [answer, source] of cases) {
      expect(normalizeSource(answer).source, `"${answer}"`).toBe(source);
    }
  });

  it("keeps Turkish dark-social answers platform-less (not reconcilable)", () => {
    expect(normalizeSource("bir arkadaşım tavsiye etti").platform).toBeNull();
    expect(normalizeSource("Google'da arattım").platform).toBeNull();
  });
});

describe("platformLabel", () => {
  it("labels known catalog platforms", () => {
    expect(platformLabel("HACKERNEWS")).toBe("Hacker News");
    expect(platformLabel("X")).toBe("X / Twitter");
    expect(platformLabel("PRODUCTHUNT")).toBe("Product Hunt");
  });
  it("humanizes an unmapped platform rather than shouting the enum", () => {
    expect(platformLabel("SOMETHINGNEW")).toBe("Somethingnew");
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

describe("confidenceFor", () => {
  it("is LOW for a small combined sample regardless of agreement", () => {
    expect(confidenceFor(2, 2)).toBe("LOW"); // sample 4 < 5
    expect(confidenceFor(4, 0)).toBe("LOW");
    expect(confidenceFor(0, 0)).toBe("LOW");
  });
  it("is HIGH when tracked and reported both credit the source (sample ≥ 5)", () => {
    expect(confidenceFor(3, 3)).toBe("HIGH");
    expect(confidenceFor(1, 8)).toBe("HIGH");
  });
  it("is MEDIUM when only one source has it (sample ≥ 5)", () => {
    expect(confidenceFor(6, 0)).toBe("MEDIUM");
    expect(confidenceFor(0, 5)).toBe("MEDIUM");
  });
});

describe("reconcileAttribution", () => {
  const view = reconcileAttribution({
    tracked: [
      { platform: "HACKERNEWS", count: 6 },
      { platform: "X", count: 2 },
    ],
    reported: [
      { platform: "HACKERNEWS", count: 4 }, // agrees with tracked → HIGH
      { platform: "REDDIT", count: 9 }, // reported only, sample 9 → MEDIUM
    ],
    unattributedTracked: 5,
    darkReported: 11,
    topDarkSource: { source: "word_of_mouth", label: "A friend or colleague", count: 7 },
  });

  it("pairs tracked + reported per source without merging them into one number", () => {
    const hn = view.channels.find((c) => c.platform === "HACKERNEWS")!;
    expect(hn).toMatchObject({ trackedSignups: 6, reportedSignups: 4, confidence: "HIGH", label: "Hacker News" });
    const reddit = view.channels.find((c) => c.platform === "REDDIT")!;
    expect(reddit).toMatchObject({ trackedSignups: 0, reportedSignups: 9, confidence: "MEDIUM" });
    const x = view.channels.find((c) => c.platform === "X")!;
    expect(x).toMatchObject({ trackedSignups: 2, reportedSignups: 0, confidence: "LOW" }); // sample 2 < 5
  });

  it("orders rows by combined evidence", () => {
    // reddit(9) ≥ hackernews(10)? hn sample = 10, reddit = 9 → hn first.
    expect(view.channels[0].platform).toBe("HACKERNEWS");
    expect(view.channels[1].platform).toBe("REDDIT");
  });

  it("keeps a dark-social bucket with a factual explainer and its share", () => {
    expect(view.darkSocial.trackedSignups).toBe(5); // unattributed tracked
    expect(view.darkSocial.reportedSignups).toBe(11); // no-platform reports
    // dark reported share of all reports = 11 / (4 + 9 + 11) = 11/24.
    expect(view.darkSocial.reportedShare).toBeCloseTo(11 / 24);
    expect(view.darkSocial.explainer).toMatch(/85%/);
    expect(view.darkSocial.explainer).toMatch(/normal/i);
    expect(view.darkSocial.topSource?.label).toBe("A friend or colleague");
  });

  it("reconciles totals within each system (nothing dropped or double-counted)", () => {
    const sumTracked = view.channels.reduce((n, c) => n + c.trackedSignups, 0);
    const sumReported = view.channels.reduce((n, c) => n + c.reportedSignups, 0);
    expect(sumTracked).toBe(view.trackedAttributed); // 6 + 2
    expect(sumReported).toBe(view.reportedAttributed); // 4 + 9
    expect(view.totalTracked).toBe(view.trackedAttributed + view.darkSocial.trackedSignups); // 8 + 5
    expect(view.totalReported).toBe(view.reportedAttributed + view.darkSocial.reportedSignups); // 13 + 11
  });

  it("handles the empty case without dividing by zero", () => {
    const e = reconcileAttribution({ tracked: [], reported: [], unattributedTracked: 0, darkReported: 0 });
    expect(e.channels).toEqual([]);
    expect(e.darkSocial.reportedShare).toBe(0);
    expect(e.totalTracked).toBe(0);
    expect(e.totalReported).toBe(0);
  });
});
