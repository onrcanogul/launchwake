/**
 * Ban-safety linter — the differentiator. Before the user posts, check the draft
 * against the channel's norms and flag what tends to get posts removed / accounts
 * banned ("link in title", "no 90/10 balance", "link in the post body on
 * LinkedIn"). Deterministic and grounded — NOT an LLM guess — so it's trustworthy
 * and instant. Pure → unit-testable and runnable client-side for live checks.
 */

export type SafetyLevel = "pass" | "warn" | "fail";

export type SafetyCheck = {
  level: SafetyLevel;
  label: string;
  detail: string;
};

export type SafetyReport = {
  checks: SafetyCheck[];
  worst: SafetyLevel;
  fails: number;
  warns: number;
};

const URL_RE = /https?:\/\/[^\s)]+/i;
const HYPE_RE =
  /\b(revolutionary|game[-\s]?chang(?:er|ing)|amazing|incredible|best[-\s]in[-\s]class|world[-\s]?class|cutting[-\s]edge|next[-\s]?gen|disrupt(?:ive)?|10x|magical?|insane|unbelievable|mind[-\s]?blowing)\b/i;

// Launch-announcement / founder-story phrasing. A Reddit self-post built around
// two or more of these reads as an ad, not a contribution — the top non-link
// removal cause on self-promo-restricted subs.
const PITCH_RE =
  /\bi(?:'ve| have)?\s+(?:built|made|created|launched|shipped|been (?:building|working on|developing))\b|\bi'?m (?:excited|thrilled|happy|glad) to (?:share|announce|introduce)\b|\blooking forward to (?:any |your )?(?:feedback|insights?|thoughts)\b|\bwould love (?:your |any |some )?feedback\b|\bcheck (?:it|us|this) out\b|\bintroducing\s+\w+/gi;

function pitchMarkers(s: string): number {
  return (s.match(PITCH_RE) ?? []).length;
}

function hasUrl(s: string): boolean {
  return URL_RE.test(s);
}

function countUrls(s: string): number {
  return (s.match(/https?:\/\//gi) ?? []).length;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export type DraftCheckInput = {
  body: string;
  platform: string;
  channelRules?: string | null;
  /** The user's product name — lets us catch a self-promo mention on subs that
   * ban promotion outright (e.g. r/programming), even a footnote plug. */
  productName?: string | null;
};

export function checkDraft(input: DraftCheckInput): SafetyReport {
  const { platform } = input;
  const body = input.body ?? "";
  const rules = (input.channelRules ?? "").toLowerCase();
  const productName = input.productName ?? null;
  const lines = body.split("\n").map((l) => l.trim());
  const nonEmpty = lines.filter(Boolean);
  const title = nonEmpty[0] ?? "";
  const firstLine = lines[0] ?? "";
  const bodyHasUrl = hasUrl(body);

  const checks: SafetyCheck[] = [];
  const add = (level: SafetyLevel, label: string, detail: string) =>
    checks.push({ level, label, detail });

  switch (platform) {
    case "REDDIT": {
      // Reddit's AutoModerator removes self-posts that carry an outbound link.
      // The safe pattern is a link-free post with the URL dropped in your OWN
      // first comment. A link in the title is always fatal; a link in the body
      // is fatal on strict/heavily-moderated subs and a caution everywhere else.
      const strict = /heavily moderated|no product promotion|removed|flagged|banned|90\/10/.test(
        rules,
      );

      if (hasUrl(title))
        add(
          "fail",
          "Link in title",
          "Reddit removes posts with a link in the title. Drop the link in your first comment instead.",
        );
      else add("pass", "No link in title", "Title is link-free.");

      const belowTitle = nonEmpty.slice(1).join("\n");
      if (hasUrl(belowTitle)) {
        if (strict)
          add(
            "fail",
            "Link in the post body",
            "This community's AutoModerator removes self-posts that contain an outbound link. Post the URL as your own first comment, not in the body.",
          );
        else
          add(
            "warn",
            "Link in the post body",
            "Many subs auto-remove self-posts with links. Safest to post the URL as your first comment, not in the body.",
          );
      } else
        add(
          "pass",
          "No link in the body",
          "Link-free — the URL belongs in your first comment.",
        );

      // A launch-announcement pitch (no link needed) is the other classic
      // removal: pure self-promo violates the 90/10 rule. Fatal on strict subs,
      // a caution elsewhere. A milder promo tone is only ever a caution.
      const pitch = pitchMarkers(body) >= 2;
      const promotional =
        /\b(our|we|my|i built|check out|try it)\b/i.test(body) && !body.includes("?");
      if (pitch)
        add(
          strict ? "fail" : "warn",
          "Reads as a self-promo launch pitch",
          "This is a launch announcement about your product — subs remove these as ads. Lead with a specific, useful insight the community cares about, keep the product to a one-line mention, and end with a genuine question.",
        );
      else if (promotional)
        add(
          "warn",
          "Reads promotional (90/10)",
          "Most subs enforce a ~90/10 rule. Lead with value or a question; mention the tool as a footnote.",
        );
      else add("pass", "Value-first tone", "Reads like a contribution, not an ad.");

      // Subs that ban promotion outright (r/programming: "no product promotion",
      // "articles only") remove ANY product mention — even a value-first post
      // with a footnote plug. Catch the product name or a plug pattern.
      const bansPromoOutright =
        /\bno (?:product |self[-\s]?)?promotion\b|\bno self[-\s]?promo\b|\barticles only\b|\bno (?:ads|advertising|marketing)\b/i.test(
          rules,
        );
      const plug =
        /(^|\n)\s*\*?\s*footnote\s*:/i.test(body) ||
        /\b(?:worked on|built|made|created|launched|maintain|building)\b[^.\n]*\b(?:tool|app|product|service|platform|saas|library|extension|plugin)\b/i.test(
          body,
        ) ||
        (productName ? new RegExp(`\\b${escapeRegExp(productName)}\\b`, "i").test(body) : false);
      if (bansPromoOutright && plug)
        add(
          "fail",
          "Product mention on a no-promotion sub",
          "This sub bans promotion outright — even a footnote plug is removed. Cut the product mention entirely; contribute pure value and let people find you via your profile.",
        );

      if (strict)
        add(
          "pass",
          "Community is strict",
          "Heavily moderated — your value-first, link-free framing fits.",
        );
      break;
    }

    case "HACKERNEWS": {
      if (rules.includes("show hn") || /^show hn:/i.test(title)) {
        if (!/^show hn:/i.test(title))
          add(
            "fail",
            "Missing 'Show HN:' prefix",
            "Show HN submissions must start with 'Show HN:'.",
          );
        else add("pass", "Show HN title format", "Title is correctly prefixed.");
      }
      if (HYPE_RE.test(body))
        add(
          "warn",
          "Marketing language",
          "HN penalises hype adjectives. State plainly what it does and why you built it.",
        );
      else add("pass", "No hype", "Plain, factual tone — HN-appropriate.");

      if (body.includes("?"))
        add("pass", "Invites discussion", "Ends with a question — HN rewards discussion.");
      else
        add(
          "warn",
          "No discussion hook",
          "Consider ending with a genuine question to spark comments.",
        );
      break;
    }

    case "X": {
      if (hasUrl(firstLine))
        add(
          "warn",
          "Link in the first line",
          "A link in the opening tweet can suppress reach. Put it last or in a reply.",
        );
      else add("pass", "Hook-first", "Opens with a hook, not a link.");

      const tooLong = nonEmpty.find((l) => l.length > 280);
      if (tooLong)
        add(
          "warn",
          "Tweet too long",
          `A line is ${tooLong.length} chars — over the 280 limit. Split it.`,
        );
      else add("pass", "Length OK", "Each line fits in a tweet.");
      break;
    }

    case "LINKEDIN": {
      if (bodyHasUrl)
        add(
          "warn",
          "Outbound link in the post",
          "LinkedIn throttles posts with links. Put the link in the first comment instead.",
        );
      else add("pass", "No outbound link", "Keep the link in the first comment.");
      break;
    }

    default: {
      if (HYPE_RE.test(body))
        add(
          "warn",
          "Marketing language",
          "Hype reads as spam in most communities. Be specific and plain.",
        );
      else add("pass", "Plain tone", "Reads genuine, not spammy.");

      if (bodyHasUrl && rules.includes("first comment"))
        add(
          "warn",
          "Link placement",
          "This channel prefers the link in the first comment.",
        );
    }
  }

  // Generic: link-heavy posts get flagged everywhere.
  const urls = countUrls(body);
  if (urls >= 3)
    add(
      "warn",
      "Multiple links",
      `${urls} links — communities flag link-heavy posts. Keep it to one.`,
    );

  const fails = checks.filter((c) => c.level === "fail").length;
  const warns = checks.filter((c) => c.level === "warn").length;
  const worst: SafetyLevel = fails > 0 ? "fail" : warns > 0 ? "warn" : "pass";
  return { checks, worst, fails, warns };
}

/** One-line verdict for the header of the safety panel. */
export function safetyVerdict(report: SafetyReport): string {
  if (report.fails > 0)
    return `Likely to be removed — fix ${report.fails} issue${report.fails === 1 ? "" : "s"}`;
  if (report.warns > 0)
    return `${report.warns} caution${report.warns === 1 ? "" : "s"} before you post`;
  return "Looks safe to post";
}
