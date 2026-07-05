import { describe, expect, it } from "vitest";
import { BanRisk } from "@prisma/client";
import { buildPlanLimitEmail, buildPlanReadyEmail } from "./shipEmail";

const BASE = {
  projectName: "Hookline",
  shipTitle: "v2.0 — realtime webhooks",
  appUrl: "https://www.launchwake.com/",
  unsubscribeUrl: "https://www.launchwake.com/api/email/unsubscribe?u=u1&t=tok",
};

describe("buildPlanReadyEmail", () => {
  const email = buildPlanReadyEmail({
    ...BASE,
    shipId: "ship_1",
    channels: [
      { name: "Hacker News — Show HN", fitScore: 92, banRisk: BanRisk.LOW },
      { name: "r/webdev", fitScore: 81, banRisk: BanRisk.MEDIUM },
      { name: "Product Hunt", fitScore: 77, banRisk: BanRisk.LOW },
      { name: "dev.to", fitScore: 70, banRisk: BanRisk.LOW },
    ],
  });

  it("leads with the ship title in the subject", () => {
    expect(email.subject).toBe(
      'Your distribution plan is ready — "v2.0 — realtime webhooks"',
    );
  });

  it("lists at most the top 3 channels with fit and ban risk", () => {
    expect(email.text).toContain("1. Hacker News — Show HN — fit 92/100 · low ban risk");
    expect(email.text).toContain("2. r/webdev — fit 81/100 · medium ban risk");
    expect(email.text).toContain("3. Product Hunt");
    expect(email.text).not.toContain("dev.to");
  });

  it("links to the plan without a doubled slash", () => {
    expect(email.text).toContain("https://www.launchwake.com/app/ships/ship_1/plan");
    expect(email.text).not.toContain("com//app");
  });

  it("restates the no-auto-posting principle and the unsubscribe link", () => {
    expect(email.text).toContain("LaunchWake never posts for you");
    expect(email.text).toContain(BASE.unsubscribeUrl);
  });
});

describe("buildPlanLimitEmail", () => {
  const email = buildPlanLimitEmail(BASE);

  it("says the release was detected but no plan was generated", () => {
    expect(email.subject).toContain("plan limit reached");
    expect(email.text).toContain("no plan was generated");
    expect(email.text).toContain("Upgrade → https://www.launchwake.com/app/settings");
  });

  it("carries the unsubscribe footer", () => {
    expect(email.text).toContain(BASE.unsubscribeUrl);
  });
});
