/**
 * Bot / prefetch detection for the public attribution endpoints.
 *
 * A tracked link lives in a public post, so its `/r/{code}` URL and the tracking
 * pixel get hit by crawlers, link-preview unfurlers, and browser prefetchers long
 * before (or instead of) a real human. Counting those as clicks/signups inflates a
 * channel's numbers and makes a founder trust the wrong channel — the exact wrong
 * conclusion. We still serve them (redirect / return 200) so nothing looks broken;
 * we just don't RECORD.
 *
 * `isLikelyBot` is pure so it's unit-testable and cheap enough to run inline on
 * the latency-sensitive redirect path.
 */

/** Request signals we inspect. All optional — a missing signal is not a bot on its own (except UA). */
export type BotSignals = {
  userAgent?: string | null;
  /** `Purpose` request header — Chrome/Safari set `prefetch` on speculative loads. */
  purpose?: string | null;
  /** `Sec-Purpose` request header — modern Chrome, e.g. `prefetch;prerender`. */
  secPurpose?: string | null;
  /** `X-Moz` request header — older Firefox sets `prefetch`. */
  moz?: string | null;
  /** `X-Purpose` request header — Safari sets `preview` for link previews. */
  xPurpose?: string | null;
};

// Substrings that mark a non-human agent. Kept lowercase; matched case-insensitively.
// Deliberately broad on the "automation" families (crawler/spider/preview/headless)
// per the product requirement, plus the household-name crawlers and HTTP libraries.
const BOT_UA_PATTERNS: readonly string[] = [
  // Generic automation / crawling
  "bot",
  "crawler",
  "crawl",
  "spider",
  "scraper",
  "slurp",
  "headless",
  "phantom",
  "puppeteer",
  "playwright",
  "selenium",
  // Link preview / unfurlers
  "preview",
  "unfurl",
  "embedly",
  "facebookexternalhit",
  "facebot",
  "twitterbot",
  "slackbot",
  "discordbot",
  "telegrambot",
  "whatsapp",
  "linkedinbot",
  "pinterest",
  "redditbot",
  "skypeuripreview",
  "vkshare",
  "google-inspectiontool",
  "chrome-lighthouse",
  "bingpreview",
  "yandex",
  "baiduspider",
  "duckduckbot",
  "applebot",
  "petalbot",
  "ahrefsbot",
  "semrushbot",
  "mj12bot",
  "dotbot",
  "gptbot",
  "claudebot",
  "ccbot",
  "bytespider",
  // HTTP libraries / CLIs (rarely a real human clicking a shared link)
  "curl",
  "wget",
  "python-requests",
  "python-urllib",
  "go-http-client",
  "okhttp",
  "axios",
  "node-fetch",
  "libwww-perl",
  "java/",
  "httpclient",
  "monitor",
  "uptime",
  "pingdom",
  "statuscake",
];

/** True when any prefetch/preview signal is present (case-insensitive). */
export function isPrefetch(signals: BotSignals): boolean {
  const purpose = (signals.purpose ?? "").toLowerCase();
  const secPurpose = (signals.secPurpose ?? "").toLowerCase();
  const moz = (signals.moz ?? "").toLowerCase();
  const xPurpose = (signals.xPurpose ?? "").toLowerCase();
  return (
    purpose.includes("prefetch") ||
    purpose.includes("preview") ||
    secPurpose.includes("prefetch") ||
    secPurpose.includes("prerender") ||
    moz.includes("prefetch") ||
    xPurpose.includes("preview") ||
    xPurpose.includes("prefetch")
  );
}

/** True when the user-agent string matches a known non-human agent. */
export function isBotUserAgent(userAgent: string | null | undefined): boolean {
  const ua = (userAgent ?? "").trim().toLowerCase();
  if (!ua) return false; // "missing UA" is handled by isLikelyBot, not here
  return BOT_UA_PATTERNS.some((p) => ua.includes(p));
}

/**
 * Should this request be treated as a bot/prefetch — i.e. served but NOT recorded?
 * True when: the user-agent is missing, the user-agent matches a known crawler/
 * spider/preview/headless family, or a prefetch/preview header is present.
 */
export function isLikelyBot(signals: BotSignals): boolean {
  const ua = (signals.userAgent ?? "").trim();
  if (!ua) return true; // no UA at all → automated / stripped; don't count it
  if (isPrefetch(signals)) return true;
  return isBotUserAgent(ua);
}

/** Read the relevant signals off a request's Headers (thin, non-pure adapter). */
export function botSignalsFromHeaders(headers: Headers): BotSignals {
  return {
    userAgent: headers.get("user-agent"),
    purpose: headers.get("purpose"),
    secPurpose: headers.get("sec-purpose"),
    moz: headers.get("x-moz"),
    xPurpose: headers.get("x-purpose"),
  };
}
