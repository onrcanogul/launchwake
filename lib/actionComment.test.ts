import { describe, it, expect } from "vitest";
import { buildPlanComment, PLAN_COMMENT_MARKER } from "./actionComment";

describe("buildPlanComment", () => {
  const comment = buildPlanComment({
    shipTitle: "v1.0 — reliable webhooks",
    channelCount: 8,
    topChannels: ["Hacker News — Show HN", "r/node", "dev.to"],
    planUrl: "https://launchwake.com/app/ships/abc/plan",
    appUrl: "https://launchwake.com",
  });

  it("carries the idempotency marker so the Action can update its own comment", () => {
    expect(comment).toContain(PLAN_COMMENT_MARKER);
  });

  it("states the ship, channel count, and links the plan", () => {
    expect(comment).toContain("v1.0 — reliable webhooks");
    expect(comment).toContain("8 channels");
    expect(comment).toContain("(https://launchwake.com/app/ships/abc/plan)");
  });

  it("lists top channels", () => {
    expect(comment).toContain("`Hacker News — Show HN`");
    expect(comment).toContain("`r/node`");
  });

  it("carries the acquisition links (ref + free Launch Checker)", () => {
    expect(comment).toContain("?ref=action");
    expect(comment).toContain("/tools/launch-checker");
  });

  it("singularizes one channel", () => {
    const one = buildPlanComment({
      shipTitle: "x",
      channelCount: 1,
      topChannels: [],
      planUrl: "u",
      appUrl: "https://launchwake.com",
    });
    expect(one).toContain("**1 channel**");
  });
});
