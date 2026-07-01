import { describe, it, expect } from "vitest";
import { checkDraft, safetyVerdict } from "./bansafety";

const find = (r: ReturnType<typeof checkDraft>, label: RegExp) =>
  r.checks.find((c) => label.test(c.label));

describe("checkDraft — Reddit", () => {
  it("fails a link in the title", () => {
    const r = checkDraft({
      platform: "REDDIT",
      body: "Check out https://hookline.dev\n\nGreat tool.",
      channelRules: "90/10 rule. no link in title.",
    });
    expect(find(r, /Link in title/)?.level).toBe("fail");
    expect(r.worst).toBe("fail");
  });

  it("warns on a promotional body and flags strict subs", () => {
    const r = checkDraft({
      platform: "REDDIT",
      body: "How I built webhook alerts\n\nWe made a tool, check out our product at https://hookline.dev",
      channelRules: "heavily moderated. removed fast.",
    });
    expect(find(r, /promotional/i)?.level).toBe("warn");
    expect(find(r, /Strict self-promo/)?.level).toBe("warn");
  });

  it("passes a value-first question post", () => {
    const r = checkDraft({
      platform: "REDDIT",
      body: "How do you get alerted when a webhook fails?\n\nSharing my setup: capture, attach payload, push to Slack.",
      channelRules: "90/10 rule.",
    });
    expect(r.worst).toBe("pass");
  });
});

describe("checkDraft — Hacker News", () => {
  it("requires the Show HN prefix", () => {
    const bad = checkDraft({
      platform: "HACKERNEWS",
      body: "Hookline: webhook alerts\n\nI built this.",
      channelRules: "Show HN is for something you built.",
    });
    expect(find(bad, /Show HN/)?.level).toBe("fail");

    const good = checkDraft({
      platform: "HACKERNEWS",
      body: "Show HN: Hookline — webhook alerts\n\nWhy I built it. Curious how you handle this?",
      channelRules: "Show HN is for something you built.",
    });
    expect(good.worst).toBe("pass");
  });

  it("warns on hype language", () => {
    const r = checkDraft({
      platform: "HACKERNEWS",
      body: "Show HN: the most revolutionary game-changer for webhooks. Thoughts?",
      channelRules: "show hn",
    });
    expect(find(r, /Marketing language/)?.level).toBe("warn");
  });
});

describe("checkDraft — X & LinkedIn", () => {
  it("warns on a link in the first tweet", () => {
    const r = checkDraft({
      platform: "X",
      body: "Try https://hookline.dev now\n\n2/ details",
    });
    expect(find(r, /first line/)?.level).toBe("warn");
  });

  it("warns on an outbound link in a LinkedIn post", () => {
    const r = checkDraft({
      platform: "LINKEDIN",
      body: "We shipped alerts. See https://hookline.dev",
    });
    expect(find(r, /Outbound link/)?.level).toBe("warn");
  });
});

describe("safetyVerdict", () => {
  it("summarises the report", () => {
    expect(safetyVerdict({ checks: [], worst: "pass", fails: 0, warns: 0 })).toMatch(
      /safe/i,
    );
    expect(safetyVerdict({ checks: [], worst: "warn", fails: 0, warns: 2 })).toMatch(
      /2 cautions/,
    );
    expect(safetyVerdict({ checks: [], worst: "fail", fails: 1, warns: 0 })).toMatch(
      /removed/i,
    );
  });
});
