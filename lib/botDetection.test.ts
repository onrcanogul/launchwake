import { describe, it, expect } from "vitest";
import {
  isLikelyBot,
  isBotUserAgent,
  isPrefetch,
  botSignalsFromHeaders,
} from "./botDetection";

const CHROME =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

describe("isBotUserAgent", () => {
  it("passes real browser user-agents through", () => {
    expect(isBotUserAgent(CHROME)).toBe(false);
    expect(isBotUserAgent(IPHONE)).toBe(false);
  });

  it("flags crawlers, spiders, and search bots", () => {
    expect(isBotUserAgent("Googlebot/2.1 (+http://www.google.com/bot.html)")).toBe(true);
    expect(isBotUserAgent("Mozilla/5.0 (compatible; bingbot/2.0)")).toBe(true);
    expect(isBotUserAgent("Baiduspider/2.0")).toBe(true);
    expect(isBotUserAgent("SomeRandomCrawler/1.0")).toBe(true);
    expect(isBotUserAgent("archive.org_bot")).toBe(true);
  });

  it("flags link-preview / unfurl agents", () => {
    expect(isBotUserAgent("facebookexternalhit/1.1")).toBe(true);
    expect(isBotUserAgent("Slackbot-LinkExpanding 1.0")).toBe(true);
    expect(isBotUserAgent("Twitterbot/1.0")).toBe(true);
    expect(isBotUserAgent("Mozilla/5.0 (compatible; Discordbot/2.0)")).toBe(true);
  });

  it("flags headless browsers and automation drivers", () => {
    expect(isBotUserAgent("Mozilla/5.0 HeadlessChrome/124.0")).toBe(true);
    expect(isBotUserAgent("puppeteer")).toBe(true);
    expect(isBotUserAgent("Playwright/1.4")).toBe(true);
  });

  it("flags HTTP libraries and monitors", () => {
    expect(isBotUserAgent("curl/8.4.0")).toBe(true);
    expect(isBotUserAgent("python-requests/2.31.0")).toBe(true);
    expect(isBotUserAgent("Go-http-client/2.0")).toBe(true);
    expect(isBotUserAgent("Pingdom.com_bot_version_1.4")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isBotUserAgent("GOOGLEBOT")).toBe(true);
    expect(isBotUserAgent("CURL/8.0")).toBe(true);
  });

  it("treats an empty/absent UA as not-a-known-bot on its own (missing UA handled upstream)", () => {
    expect(isBotUserAgent("")).toBe(false);
    expect(isBotUserAgent(null)).toBe(false);
    expect(isBotUserAgent(undefined)).toBe(false);
  });
});

describe("isPrefetch", () => {
  it("detects the Purpose: prefetch header", () => {
    expect(isPrefetch({ purpose: "prefetch" })).toBe(true);
    expect(isPrefetch({ purpose: "Prefetch" })).toBe(true);
  });

  it("detects Sec-Purpose prefetch/prerender", () => {
    expect(isPrefetch({ secPurpose: "prefetch" })).toBe(true);
    expect(isPrefetch({ secPurpose: "prefetch;prerender" })).toBe(true);
  });

  it("detects older Firefox X-Moz: prefetch and Safari X-Purpose: preview", () => {
    expect(isPrefetch({ moz: "prefetch" })).toBe(true);
    expect(isPrefetch({ xPurpose: "preview" })).toBe(true);
  });

  it("is false for a normal navigation with no prefetch headers", () => {
    expect(isPrefetch({ userAgent: CHROME })).toBe(false);
    expect(isPrefetch({})).toBe(false);
  });
});

describe("isLikelyBot", () => {
  it("lets a real human click through", () => {
    expect(isLikelyBot({ userAgent: CHROME })).toBe(false);
    expect(isLikelyBot({ userAgent: IPHONE })).toBe(false);
  });

  it("treats a missing user-agent as a bot", () => {
    expect(isLikelyBot({})).toBe(true);
    expect(isLikelyBot({ userAgent: "" })).toBe(true);
    expect(isLikelyBot({ userAgent: "   " })).toBe(true);
    expect(isLikelyBot({ userAgent: null })).toBe(true);
  });

  it("treats a prefetch of an otherwise-real browser as a bot (don't count speculative loads)", () => {
    expect(isLikelyBot({ userAgent: CHROME, secPurpose: "prefetch" })).toBe(true);
    expect(isLikelyBot({ userAgent: CHROME, purpose: "prefetch" })).toBe(true);
  });

  it("treats known crawler user-agents as bots", () => {
    expect(isLikelyBot({ userAgent: "Googlebot/2.1" })).toBe(true);
    expect(isLikelyBot({ userAgent: "facebookexternalhit/1.1" })).toBe(true);
  });
});

describe("botSignalsFromHeaders", () => {
  it("reads the relevant headers off a Headers object", () => {
    const h = new Headers({
      "user-agent": CHROME,
      "sec-purpose": "prefetch;prerender",
      "x-purpose": "preview",
    });
    const s = botSignalsFromHeaders(h);
    expect(s.userAgent).toBe(CHROME);
    expect(s.secPurpose).toBe("prefetch;prerender");
    expect(s.xPurpose).toBe("preview");
    expect(isLikelyBot(s)).toBe(true);
  });
});
