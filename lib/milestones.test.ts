import { describe, it, expect } from "vitest";
import {
  computeMilestones,
  buildMilestoneEmail,
  milestoneSubject,
  type MilestoneStats,
  type Milestone,
} from "./milestones";

function stats(over: Partial<MilestoneStats> = {}): MilestoneStats {
  return { clicks: 0, totalSignups: 0, signupsByChannel: [], ...over };
}

describe("computeMilestones", () => {
  it("emits a first-signup milestone per channel, strongest first", () => {
    const ms = computeMilestones(
      stats({
        totalSignups: 8,
        signupsByChannel: [
          { channel: "Show HN", signups: 3 },
          { channel: "r/webdev", signups: 5 },
        ],
      }),
    );
    const firstSignups = ms.filter((m) => m.kind === "FIRST_SIGNUP");
    expect(firstSignups.map((m) => m.key)).toEqual(["r/webdev", "Show HN"]);
    expect(firstSignups[0].label).toBe("First signup from r/webdev");
  });

  it("emits the highest crossed ten as a signup-count milestone", () => {
    expect(computeMilestones(stats({ totalSignups: 9 })).some((m) => m.kind === "SIGNUP_COUNT")).toBe(false);
    const at24 = computeMilestones(stats({ totalSignups: 24 }));
    const count = at24.find((m) => m.kind === "SIGNUP_COUNT");
    expect(count?.key).toBe("20");
    expect(count?.label).toBe("You passed 20 signups");
  });

  it("emits a first-click milestone once there's any click", () => {
    expect(computeMilestones(stats({ clicks: 0 })).some((m) => m.kind === "FIRST_CLICK")).toBe(false);
    expect(computeMilestones(stats({ clicks: 1 })).some((m) => m.kind === "FIRST_CLICK")).toBe(true);
  });

  it("returns nothing for an account with no activity", () => {
    expect(computeMilestones(stats())).toEqual([]);
  });

  it("orders signups before the count before the click (headline priority)", () => {
    const ms = computeMilestones(
      stats({ clicks: 5, totalSignups: 10, signupsByChannel: [{ channel: "Show HN", signups: 10 }] }),
    );
    expect(ms.map((m) => m.kind)).toEqual(["FIRST_SIGNUP", "SIGNUP_COUNT", "FIRST_CLICK"]);
  });
});

describe("milestoneSubject", () => {
  it("matches the spec example for a first signup", () => {
    const m: Milestone = { kind: "FIRST_SIGNUP", key: "Show HN", label: "x" };
    expect(milestoneSubject(m)).toBe("First signup from Show HN");
  });
  it("headlines a signup count and a first click", () => {
    expect(milestoneSubject({ kind: "SIGNUP_COUNT", key: "20", label: "x" })).toBe(
      "You just passed 20 signups",
    );
    expect(milestoneSubject({ kind: "FIRST_CLICK", key: "", label: "x" })).toMatch(/first tracked click/);
  });
});

describe("buildMilestoneEmail", () => {
  const email = buildMilestoneEmail({
    projectName: "Hookline",
    appUrl: "https://launchwake.com/",
    unsubscribeUrl: "https://launchwake.com/api/email/unsubscribe?u=u1&t=tok",
    milestones: [
      { kind: "FIRST_SIGNUP", key: "Show HN", label: "First signup from Show HN" },
      { kind: "SIGNUP_COUNT", key: "10", label: "You passed 10 signups" },
    ],
  });

  it("leads the subject with the first (best) milestone", () => {
    expect(email.subject).toBe("First signup from Show HN");
  });

  it("lists every milestone in the batch and links Results without a doubled slash", () => {
    expect(email.text).toContain("• First signup from Show HN");
    expect(email.text).toContain("• You passed 10 signups");
    expect(email.text).toContain("https://launchwake.com/app/results");
    expect(email.text).not.toContain("com//app");
  });

  it("carries the unsubscribe footer", () => {
    expect(email.text).toContain("https://launchwake.com/api/email/unsubscribe?u=u1&t=tok");
  });
});
