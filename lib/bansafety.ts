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

function hasUrl(s: string): boolean {
  return URL_RE.test(s);
}

function countUrls(s: string): number {
  return (s.match(/https?:\/\//gi) ?? []).length;
}

export type DraftCheckInput = {
  body: string;
  platform: string;
  channelRules?: string | null;
};

export function checkDraft(input: DraftCheckInput): SafetyReport {
  const { platform } = input;
  const body = input.body ?? "";
  const rules = (input.channelRules ?? "").toLowerCase();
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
      if (hasUrl(title))
        add(
          "fail",
          "Link in title",
          "Reddit removes posts with a link in the title. Move it into the body or first comment.",
        );
      else add("pass", "No link in title", "Title is link-free.");

      const promotional =
        bodyHasUrl && /\b(our|we|my|i built|check out|try it)\b/i.test(body) && !body.includes("?");
      if (promotional)
        add(
          "warn",
          "Reads promotional (90/10)",
          "Most subs enforce a ~90/10 rule. Lead with value or a question; mention the tool as a footnote.",
        );
      else add("pass", "Value-first tone", "Reads like a contribution, not an ad.");

      const strict = /heavily moderated|no product promotion|removed|90\/10/.test(rules);
      if (strict && promotional)
        add(
          "warn",
          "Strict self-promo rules",
          "This community removes promo fast — keep links minimal and engage in the comments.",
        );
      else if (strict)
        add(
          "pass",
          "Community is strict",
          "Heavily moderated, but your value-first framing fits.",
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
