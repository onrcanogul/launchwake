/**
 * Self-reported attribution — "how did you hear about us?".
 *
 * The hero fact this module exists for: a tracked link / UTM only ever sees a
 * *click*. The podcast mention, the Discord DM, the "a friend told me" — the
 * dark social that actually drives most signups — sends people to type the URL
 * directly, leaving no click to attribute. Asking the human is the only way to
 * catch it. (Research: UTM-alone files the majority of real conversions under
 * the wrong channel, usually "direct".)
 *
 * This file is PURE — no db, no env, no Prisma runtime import — so both client
 * components (LaunchWake's own signup form, the Settings snippet preview) and
 * the server can share the option catalog and normalization. The db side
 * (recordSelfReport / getSelfReportRollup) lives in lib/attribution.ts.
 */

import type { Platform } from "@prisma/client";

/** Longest answer we store — a chosen label is short; free text is truncated. */
export const MAX_ANSWER_LEN = 200;

export type SelfReportOption = {
  /** Stable machine key stored as `SelfReport.source`. */
  value: string;
  /** Human label shown in the dropdown. */
  label: string;
  /**
   * The catalog platform this source reconciles against, or null when the source
   * has no distribution channel (word of mouth, search, a podcast) — i.e. it is
   * pure dark social that link attribution can never see.
   */
  platform: Platform | null;
};

/**
 * The recommended answer set — coarse, dev-founder-shaped, and ordered by how
 * commonly each drives a technical-product signup. Deliberately coarse: someone
 * says "Reddit", not "r/webdev", so these map to a *platform*, not a specific
 * catalog channel. This same list seeds the customer survey snippet and
 * LaunchWake's own signup, so the two funnels speak one taxonomy.
 */
export const SELF_REPORT_OPTIONS: readonly SelfReportOption[] = [
  { value: "word_of_mouth", label: "A friend or colleague", platform: null },
  { value: "hackernews", label: "Hacker News", platform: "HACKERNEWS" },
  { value: "reddit", label: "Reddit", platform: "REDDIT" },
  { value: "x", label: "X / Twitter", platform: "X" },
  { value: "linkedin", label: "LinkedIn", platform: "LINKEDIN" },
  { value: "producthunt", label: "Product Hunt", platform: "PRODUCTHUNT" },
  { value: "youtube", label: "YouTube", platform: "YOUTUBE" },
  { value: "podcast", label: "A podcast", platform: null },
  { value: "newsletter", label: "A newsletter", platform: "NEWSLETTER" },
  { value: "blog", label: "A blog or article", platform: "BLOG" },
  { value: "community", label: "A Slack or Discord community", platform: "DISCORD" },
  { value: "github", label: "GitHub", platform: null },
  { value: "search", label: "Google or search", platform: null },
  { value: "ai", label: "ChatGPT or an AI assistant", platform: null },
  { value: "other", label: "Something else", platform: null },
] as const;

const OPTION_BY_VALUE = new Map(SELF_REPORT_OPTIONS.map((o) => [o.value, o]));

/** Is `value` one of the known source keys? */
export function isKnownSource(value: string): boolean {
  return OPTION_BY_VALUE.has(value);
}

/** The option for a source key, or the "other" catch-all. */
export function optionForSource(source: string): SelfReportOption {
  return OPTION_BY_VALUE.get(source) ?? OPTION_BY_VALUE.get("other")!;
}

/** Display label for a source key (falls back to the raw key, humanized). */
export function sourceLabel(source: string): string {
  return OPTION_BY_VALUE.get(source)?.label ?? source;
}

/** The platform a source key reconciles against (null = pure dark social). */
export function sourcePlatform(source: string): Platform | null {
  return OPTION_BY_VALUE.get(source)?.platform ?? null;
}

/** Human display label for a catalog platform (the reconciliation row header). */
const PLATFORM_LABELS: Record<string, string> = {
  HACKERNEWS: "Hacker News",
  REDDIT: "Reddit",
  PRODUCTHUNT: "Product Hunt",
  INDIEHACKERS: "Indie Hackers",
  DEVTO: "DEV.to",
  LOBSTERS: "Lobsters",
  X: "X / Twitter",
  LINKEDIN: "LinkedIn",
  DISCORD: "Discord",
  SLACK: "Slack",
  NEWSLETTER: "Newsletter",
  DIRECTORY: "Directory",
  MASTODON: "Mastodon",
  BLUESKY: "Bluesky",
  FORUM: "Forum",
  YOUTUBE: "YouTube",
  BLOG: "Blog",
  OTHER: "Other",
};

/** Display label for a catalog platform; falls back to a humanized enum name. */
export function platformLabel(platform: Platform | string): string {
  const key = String(platform);
  return PLATFORM_LABELS[key] ?? key.charAt(0) + key.slice(1).toLowerCase();
}

/**
 * Free-text alias → source key. Matched (substring, case-insensitive) against
 * the answer AFTER exact-key match fails, so a customer form that sends its own
 * label ("Twitter", "a friend recommended it", "chatgpt") still normalizes into
 * the shared taxonomy. The survey runs on the *customer's* site in whatever
 * language they use, so aliases include Turkish (and other) phrasings alongside
 * English. More specific aliases first; word-of-mouth is last so a named platform
 * always wins over "a friend shared it on X".
 */
const ALIASES: Array<[patterns: string[], source: string]> = [
  [["hacker news", "hackernews", "ycombinator", "news.yc", "show hn", " hn ", "hn.", "on hn"], "hackernews"],
  [["product hunt", "producthunt", "prod hunt", "ürün avı"], "producthunt"],
  [["twitter", "tweet", "x.com", " x ", "on x", "x'te", "x'ten", "x’te", "twitter'da", "twitter’da"], "x"],
  [["linkedin", "linkedin'de", "linkedin’de"], "linkedin"],
  [["reddit", "subreddit", "r/", "reddit'te", "reddit'de", "reddit’te"], "reddit"],
  [["youtube", "yt video", "a youtube", "youtube'da", "youtube’da", "video"], "youtube"],
  [["podcast"], "podcast"],
  [["newsletter", "substack", "email digest", "bülten", "e-bülten", "e-posta bülteni"], "newsletter"],
  [["dev.to", "medium", "blog", "article", "hashnode", "makale", "blog yazısı", "yazısında"], "blog"],
  [["discord", "slack", "community", "forum", "topluluk", "sunucusunda"], "community"],
  [["github", "gh repo", "open source", "open-source", "açık kaynak"], "github"],
  [["chatgpt", "gpt", "claude", "perplexity", "copilot", "ai assistant", " llm", "gemini", "yapay zeka", "yapay zekâ"], "ai"],
  [["google", "search", "bing", "seo", "duckduckgo", "searched", "arama", "arattım", "aratınca", "internette", "internetten", "google'da", "google’da"], "search"],
  [
    [
      // English
      "friend", "colleague", "coworker", "co-worker", "word of mouth", "referral",
      "referred", "recommend", "someone told", "a person",
      // Turkish: arkadaş(ım/ı), meslektaş, tavsiye, öner(di/i), tanıdık, biri söyledi, duydum, kulaktan kulağa
      "arkadaş", "meslektaş", "iş arkadaş", "tavsiye", "öner", "tanıdık", "biri söyledi", "birisi söyledi", "duydum", "kulaktan kulağa", "ağızdan ağıza",
    ],
    "word_of_mouth",
  ],
];

export type NormalizedSource = {
  /** Normalized source key. */
  source: string;
  /** Platform it reconciles against, or null (pure dark social). */
  platform: Platform | null;
};

/**
 * Normalize a raw answer (a chosen option value OR arbitrary customer free text)
 * into the shared taxonomy. Unknown text → "other". Pure + total: always returns
 * a valid source.
 */
export function normalizeSource(answer: string): NormalizedSource {
  const raw = (answer ?? "").trim();
  const key = raw.toLowerCase();

  // 1. Exact known key (LaunchWake's own form + snippets send these).
  if (OPTION_BY_VALUE.has(key)) {
    return { source: key, platform: sourcePlatform(key) };
  }

  // 2. Fuzzy alias match on free text. Pad so word-ish patterns like " x " work.
  const hay = ` ${key} `;
  for (const [patterns, source] of ALIASES) {
    if (patterns.some((p) => hay.includes(p))) {
      return { source, platform: sourcePlatform(source) };
    }
  }

  // 3. Unknown → other (the raw answer is preserved separately on the row).
  return { source: "other", platform: null };
}

// ── Rollup (pure aggregation over already-fetched rows) ────────────────────

/** One self-report, flattened for aggregation (db layer resolves lwRef→platform). */
export type SelfReportRow = {
  source: string;
  /** True when a tracked-link ref was present at the same moment. */
  hasRef: boolean;
  /** Platform behind that ref (from the tracked link's channel), if resolvable. */
  linkPlatform: Platform | string | null;
};

export type SourceCount = {
  source: string;
  label: string;
  count: number;
  /** Fraction of all self-reports (0..1). */
  share: number;
};

export type SelfReportRollup = {
  total: number;
  bySource: SourceCount[];
  /** Reports with NO tracked ref — the pure dark-social slice. */
  darkSocialCount: number;
  darkSocialShare: number;
  /** Top source among the dark-social (no-ref) reports. */
  topDarkSource: SourceCount | null;
  /** Reports that DID carry a tracked ref. */
  trackedCount: number;
  /**
   * Divergence: of the tracked reports where both the link's platform and the
   * self-reported platform are known, how many DISAGREE. This is the number that
   * proves UTM was crediting the wrong channel.
   */
  reconciledCount: number;
  agreeCount: number;
  disagreeCount: number;
  divergenceShare: number;
};

function pct(part: number, whole: number): number {
  return whole > 0 ? part / whole : 0;
}

/** Aggregate raw self-report rows into the dark-social / divergence rollup. Pure. */
export function rollupSelfReports(rows: SelfReportRow[]): SelfReportRollup {
  const total = rows.length;

  const counts = new Map<string, number>();
  const darkCounts = new Map<string, number>();
  let darkSocialCount = 0;
  let trackedCount = 0;
  let reconciledCount = 0;
  let disagreeCount = 0;

  for (const r of rows) {
    counts.set(r.source, (counts.get(r.source) ?? 0) + 1);
    if (r.hasRef) {
      trackedCount += 1;
      const selfPlatform = sourcePlatform(r.source);
      if (selfPlatform && r.linkPlatform) {
        reconciledCount += 1;
        if (selfPlatform !== r.linkPlatform) disagreeCount += 1;
      }
    } else {
      darkSocialCount += 1;
      darkCounts.set(r.source, (darkCounts.get(r.source) ?? 0) + 1);
    }
  }

  const bySource: SourceCount[] = [...counts.entries()]
    .map(([source, count]) => ({
      source,
      label: sourceLabel(source),
      count,
      share: pct(count, total),
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  const topDark = [...darkCounts.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  )[0];
  const topDarkSource: SourceCount | null = topDark
    ? {
        source: topDark[0],
        label: sourceLabel(topDark[0]),
        count: topDark[1],
        share: pct(topDark[1], darkSocialCount),
      }
    : null;

  return {
    total,
    bySource,
    darkSocialCount,
    darkSocialShare: pct(darkSocialCount, total),
    topDarkSource,
    trackedCount,
    reconciledCount,
    agreeCount: reconciledCount - disagreeCount,
    disagreeCount,
    divergenceShare: pct(disagreeCount, reconciledCount),
  };
}

function asPct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

/**
 * The deterministic "what LaunchWake sees" line for self-reported attribution —
 * the dark-social reveal. Free (no LLM). Returns null with too little data.
 */
export function buildSelfReportInsight(rollup: SelfReportRollup): string | null {
  if (rollup.total < 3) return null;

  const parts: string[] = [];

  if (rollup.darkSocialCount > 0 && rollup.topDarkSource) {
    parts.push(
      `${asPct(rollup.darkSocialShare)} of the people who signed up named a source no tracked link ever saw — top: ${rollup.topDarkSource.label} (${asPct(rollup.topDarkSource.share)}). UTM alone would have filed these under "direct".`,
    );
  }

  if (rollup.reconciledCount >= 3 && rollup.disagreeCount > 0) {
    parts.push(
      `On ${rollup.reconciledCount} signup${rollup.reconciledCount === 1 ? "" : "s"} that also had a tracked link, ${rollup.disagreeCount} (${asPct(rollup.divergenceShare)}) said they came from a different channel than the link credited.`,
    );
  }

  if (parts.length === 0 && rollup.bySource[0]) {
    parts.push(
      `Most signups say they came from ${rollup.bySource[0].label} (${asPct(rollup.bySource[0].share)}).`,
    );
  }

  return parts.join(" ");
}

// ── Reconciliation: tracked (Events) vs reported (survey) ──────────────────
// Two independent measurement systems, deliberately NOT merged into one "exact"
// number. Tracked = link-attributed SIGNUP events (verifiable). Reported = survey
// answers mapped to a platform (self-reported, unverifiable). We show both side by
// side per source with a confidence label, plus a dark-social bucket for whatever
// neither system pins to a channel.

export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";

/** Below this combined sample a row is LOW confidence regardless of agreement. */
export const MIN_CONFIDENT_SAMPLE = 5;

/**
 * Blended confidence for a source row — NOT a merged count, just how much to trust
 * the pair. LOW when the combined sample is small (< MIN_CONFIDENT_SAMPLE); HIGH
 * when tracked and reported BOTH credit this source (two independent signals
 * agree); MEDIUM when only one of the two has it.
 */
export function confidenceFor(trackedSignups: number, reportedSignups: number): ConfidenceLevel {
  const sample = trackedSignups + reportedSignups;
  if (sample < MIN_CONFIDENT_SAMPLE) return "LOW";
  if (trackedSignups > 0 && reportedSignups > 0) return "HIGH";
  return "MEDIUM";
}

export type PlatformCount = { platform: Platform | string; count: number };

export type ReconciledChannel = {
  platform: string;
  label: string;
  trackedSignups: number;
  reportedSignups: number;
  /** trackedSignups + reportedSignups (drives ordering + confidence). */
  sample: number;
  confidence: ConfidenceLevel;
};

export type DarkSocialBucket = {
  /** Survey answers whose source has no channel (word of mouth, podcast, search…). */
  reportedSignups: number;
  /** Tracked SIGNUP events with no channel (no lw_ref, no email match). */
  trackedSignups: number;
  /** reportedSignups + trackedSignups. */
  total: number;
  /** Dark social as a share of ALL self-reported answers (0..1). */
  reportedShare: number;
  /** Top named dark-social source, for the explainer line. */
  topSource: { source: string; label: string; count: number } | null;
  /** Factual, brand-honest one-liner (kept research-accurate, never alarmist). */
  explainer: string;
};

export type ReconciliationView = {
  channels: ReconciledChannel[];
  darkSocial: DarkSocialBucket;
  /** All link-attributed tracked signups (Σ channels.trackedSignups). */
  trackedAttributed: number;
  /** All platform-mapped reports (Σ channels.reportedSignups). */
  reportedAttributed: number;
  /** Every tracked SIGNUP event: attributed + unattributed. */
  totalTracked: number;
  /** Every survey answer: platform-mapped + dark social. */
  totalReported: number;
};

/** Factual dark-social explainer — honesty as a brand feature, no hype. */
export const DARK_SOCIAL_EXPLAINER =
  "Dark social is the sharing analytics can't see — DMs, group chats, Slack, podcasts, someone typing your URL after a friend mentioned it. Industry-wide, roughly 85% of sharing happens here, so a large unknown slice is normal, not a tracking failure.";

/**
 * Reconcile the two attribution systems into one honest view. Pure. `tracked` and
 * `reported` are per-platform counts; `unattributedTracked` / `darkReported` are
 * the channel-less remainders. Rows sort by combined evidence. Totals reconcile
 * WITHIN each system (attributed + remainder = system total), and the two systems
 * stay separate — a tracked count and a reported count are never summed into one.
 */
export function reconcileAttribution(input: {
  tracked: PlatformCount[];
  reported: PlatformCount[];
  unattributedTracked: number;
  darkReported: number;
  topDarkSource?: { source: string; label: string; count: number } | null;
}): ReconciliationView {
  const sumInto = (rows: PlatformCount[]): Map<string, number> => {
    const m = new Map<string, number>();
    for (const r of rows) {
      const k = String(r.platform);
      m.set(k, (m.get(k) ?? 0) + Math.max(0, r.count));
    }
    return m;
  };
  const trackedByP = sumInto(input.tracked);
  const reportedByP = sumInto(input.reported);

  const channels: ReconciledChannel[] = [...new Set([...trackedByP.keys(), ...reportedByP.keys()])]
    .map((p) => {
      const trackedSignups = trackedByP.get(p) ?? 0;
      const reportedSignups = reportedByP.get(p) ?? 0;
      return {
        platform: p,
        label: platformLabel(p),
        trackedSignups,
        reportedSignups,
        sample: trackedSignups + reportedSignups,
        confidence: confidenceFor(trackedSignups, reportedSignups),
      };
    })
    .sort(
      (a, b) =>
        b.sample - a.sample ||
        b.trackedSignups - a.trackedSignups ||
        a.label.localeCompare(b.label),
    );

  const trackedAttributed = [...trackedByP.values()].reduce((n, v) => n + v, 0);
  const reportedAttributed = [...reportedByP.values()].reduce((n, v) => n + v, 0);
  const totalReported = reportedAttributed + input.darkReported;

  return {
    channels,
    darkSocial: {
      reportedSignups: input.darkReported,
      trackedSignups: input.unattributedTracked,
      total: input.darkReported + input.unattributedTracked,
      reportedShare: totalReported > 0 ? input.darkReported / totalReported : 0,
      topSource: input.topDarkSource ?? null,
      explainer: DARK_SOCIAL_EXPLAINER,
    },
    trackedAttributed,
    reportedAttributed,
    totalTracked: trackedAttributed + input.unattributedTracked,
    totalReported,
  };
}
