import { describe, it, expect } from "vitest";
import {
  planUrl,
  settingsUrl,
  buildPlanReadyEmail,
  buildPlanLimitEmail,
} from "./shipNotify";

describe("url helpers", () => {
  it("build trailing-slash-safe URLs", () => {
    expect(planUrl("https://launchwake.com/", "ship1")).toBe(
      "https://launchwake.com/app/ships/ship1/plan",
    );
    expect(planUrl("https://launchwake.com", "ship1")).toBe(
      "https://launchwake.com/app/ships/ship1/plan",
    );
    expect(settingsUrl("https://launchwake.com/")).toBe(
      "https://launchwake.com/app/settings",
    );
  });
});

describe("buildPlanReadyEmail", () => {
  it("leads the subject with the version and links the plan", () => {
    const mail = buildPlanReadyEmail({
      shipTitle: "v1.4.0",
      projectName: "Hookline",
      url: "https://launchwake.com/app/ships/s1/plan",
    });
    expect(mail.subject).toBe("v1.4.0 shipped — your distribution plan is ready");
    expect(mail.text).toContain("Hookline");
    expect(mail.text).toContain("https://launchwake.com/app/ships/s1/plan");
    // Reinforce the product principle: we never post for them.
    expect(mail.text).toMatch(/never posts on your behalf/i);
  });
});

describe("buildPlanLimitEmail", () => {
  it("states the quota used and nudges an upgrade", () => {
    const mail = buildPlanLimitEmail({
      shipTitle: "v1.4.0",
      projectName: "Hookline",
      used: 2,
      limit: 2,
      upgradeUrl: "https://launchwake.com/app/settings",
    });
    expect(mail.subject).toBe("v1.4.0 shipped — you're at your Free plan limit");
    expect(mail.text).toContain("2/2");
    expect(mail.text).toContain("https://launchwake.com/app/settings");
    // The ship is not lost — reassure them.
    expect(mail.text).toMatch(/still in your feed/i);
  });
});
