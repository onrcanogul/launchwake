import { describe, it, expect } from "vitest";
import {
  AccountRequirementsSchema,
  parseAccountRequirements,
  computeAccountReadiness,
  daysUntilLaunch,
  readinessChip,
  KARMA_WARMUP_DAYS,
  AT_RISK_PENALTY,
  type AccountRequirements,
} from "./accountReadiness";

const NOW = new Date("2026-01-01T00:00:00.000Z");
const DAY = 86_400_000;
const inDays = (n: number) => new Date(NOW.getTime() + n * DAY);

const ageReq: AccountRequirements = {
  level: "required",
  minAccountAgeDays: 30,
  profileTips: ["Fill out your bio."],
  sourceNote: "Test rule.",
};
const karmaReq: AccountRequirements = {
  level: "recommended",
  minKarmaOrReputation: { value: 100, unit: "karma" },
  profileTips: ["Comment for a week first."],
  sourceNote: "Test rule.",
};
const bothReq: AccountRequirements = {
  level: "required",
  minAccountAgeDays: 90,
  minKarmaOrReputation: { value: 500, unit: "karma" },
  sourceNote: "Test rule.",
};
const tipsOnly: AccountRequirements = {
  level: "recommended",
  profileTips: ["Complete your maker profile."],
  sourceNote: "Test rule.",
};

describe("AccountRequirementsSchema (catalog validation)", () => {
  it("accepts a full entry and defaults level to 'recommended'", () => {
    const parsed = AccountRequirementsSchema.parse({
      minAccountAgeDays: 14,
      minKarmaOrReputation: { value: 30, unit: "followers" },
      profileTips: ["Complete your profile."],
      sourceNote: "Product Hunt maker guidance.",
    });
    expect(parsed.level).toBe("recommended");
    expect(parsed.minKarmaOrReputation).toEqual({ value: 30, unit: "followers" });
  });

  it("requires a sourceNote", () => {
    expect(AccountRequirementsSchema.safeParse({ minAccountAgeDays: 30 }).success).toBe(
      false,
    );
  });

  it("rejects a non-positive account age and negative karma", () => {
    expect(
      AccountRequirementsSchema.safeParse({ minAccountAgeDays: 0, sourceNote: "x" })
        .success,
    ).toBe(false);
    expect(
      AccountRequirementsSchema.safeParse({
        minKarmaOrReputation: { value: -1, unit: "karma" },
        sourceNote: "x",
      }).success,
    ).toBe(false);
  });

  it("rejects unknown keys (strict) to catch seed typos", () => {
    expect(
      AccountRequirementsSchema.safeParse({
        sourceNote: "x",
        minAccountAgeDay: 30, // typo
      }).success,
    ).toBe(false);
  });
});

describe("parseAccountRequirements", () => {
  it("returns null for null/undefined/garbage", () => {
    expect(parseAccountRequirements(null)).toBeNull();
    expect(parseAccountRequirements(undefined)).toBeNull();
    expect(parseAccountRequirements({})).toBeNull();
    expect(parseAccountRequirements("nope")).toBeNull();
  });

  it("parses a stored JSON value into typed requirements", () => {
    const parsed = parseAccountRequirements({
      minAccountAgeDays: 30,
      sourceNote: "Test.",
    });
    expect(parsed?.minAccountAgeDays).toBe(30);
    expect(parsed?.level).toBe("recommended");
  });
});

describe("daysUntilLaunch", () => {
  it("is null when no valid launch date is set", () => {
    expect(daysUntilLaunch(null, NOW)).toBeNull();
    expect(daysUntilLaunch(undefined, NOW)).toBeNull();
    expect(daysUntilLaunch(new Date("invalid"), NOW)).toBeNull();
  });

  it("floors whole days to the launch date", () => {
    expect(daysUntilLaunch(inDays(10), NOW)).toBe(10);
    expect(daysUntilLaunch(new Date(NOW.getTime() + 5.9 * DAY), NOW)).toBe(5);
  });
});

describe("computeAccountReadiness — lead time", () => {
  it("returns null when the channel has no requirements", () => {
    expect(computeAccountReadiness(null, { now: NOW })).toBeNull();
  });

  it("derives lead time from account age and phrases it in whole weeks", () => {
    const block = computeAccountReadiness(ageReq, { now: NOW })!;
    expect(block.leadTimeDays).toBe(30);
    expect(block.leadTimeHint).toBe(
      "Create this account at least 5 weeks before launch.",
    );
  });

  it("uses the karma warm-up window when there is no age threshold", () => {
    const block = computeAccountReadiness(karmaReq, { now: NOW })!;
    expect(block.leadTimeDays).toBe(KARMA_WARMUP_DAYS);
    expect(block.leadTimeHint).toContain("warm up");
    expect(block.leadTimeHint).toContain("2 weeks");
  });

  it("takes the larger of account-age and karma warm-up", () => {
    const block = computeAccountReadiness(bothReq, { now: NOW })!;
    expect(block.leadTimeDays).toBe(90); // max(90, 14)
  });

  it("has no lead time or hint when only profile tips are given", () => {
    const block = computeAccountReadiness(tipsOnly, { now: NOW })!;
    expect(block.leadTimeDays).toBe(0);
    expect(block.leadTimeHint).toBeNull();
  });
});

describe("computeAccountReadiness — no launch date (graceful)", () => {
  it("shows tips but no warning, and marks requirements 'unknown'", () => {
    const block = computeAccountReadiness(ageReq, { now: NOW })!;
    expect(block.atRisk).toBe(false);
    expect(block.warning).toBeNull();
    expect(block.fitPenalty).toBe(0);
    expect(block.tips).toEqual(["Fill out your bio."]);
    expect(block.badges[0]).toMatchObject({ key: "age", status: "unknown" });
  });
});

describe("computeAccountReadiness — at-risk detection", () => {
  it("is at-risk when the launch is sooner than the lead time", () => {
    const block = computeAccountReadiness(ageReq, {
      now: NOW,
      launchAt: inDays(10),
      channelName: "r/test",
    })!;
    expect(block.atRisk).toBe(true);
    expect(block.badges[0].status).toBe("at-risk");
    expect(block.warning).toContain("r/test");
  });

  it("is not at-risk when the launch is far enough out (age badge met)", () => {
    const block = computeAccountReadiness(ageReq, {
      now: NOW,
      launchAt: inDays(60),
    })!;
    expect(block.atRisk).toBe(false);
    expect(block.warning).toBeNull();
    expect(block.badges[0].status).toBe("met");
  });

  it("flags the age requirement at-risk but karma met on a near launch", () => {
    const block = computeAccountReadiness(bothReq, {
      now: NOW,
      launchAt: inDays(20),
    })!;
    expect(block.atRisk).toBe(true);
    const age = block.badges.find((b) => b.key === "age");
    const karma = block.badges.find((b) => b.key === "karma");
    expect(age?.status).toBe("at-risk"); // 20 < 90
    expect(karma?.status).toBe("met"); // 20 >= 14 warm-up
  });

  it("treats a launch date that has already arrived as at-risk", () => {
    const block = computeAccountReadiness(ageReq, { now: NOW, launchAt: NOW })!;
    expect(block.atRisk).toBe(true);
    expect(block.warning).toContain("launch date has arrived");
  });

  it("never flags tips-only channels as at-risk", () => {
    const block = computeAccountReadiness(tipsOnly, {
      now: NOW,
      launchAt: inDays(1),
    })!;
    expect(block.atRisk).toBe(false);
    expect(block.fitPenalty).toBe(0);
  });
});

describe("computeAccountReadiness — fit-score penalty", () => {
  it("applies the required penalty when a required channel is at-risk", () => {
    const block = computeAccountReadiness(ageReq, { now: NOW, launchAt: inDays(5) })!;
    expect(block.fitPenalty).toBe(AT_RISK_PENALTY.required);
  });

  it("applies the smaller recommended penalty when recommended is at-risk", () => {
    const block = computeAccountReadiness(karmaReq, { now: NOW, launchAt: inDays(3) })!;
    expect(block.fitPenalty).toBe(AT_RISK_PENALTY.recommended);
    expect(AT_RISK_PENALTY.recommended).toBeLessThan(AT_RISK_PENALTY.required);
  });

  it("applies no penalty when not at-risk", () => {
    const block = computeAccountReadiness(ageReq, { now: NOW, launchAt: inDays(90) })!;
    expect(block.fitPenalty).toBe(0);
  });
});

describe("readinessChip", () => {
  it("labels an at-risk block", () => {
    const block = computeAccountReadiness(ageReq, { now: NOW, launchAt: inDays(2) })!;
    expect(readinessChip(block)).toEqual({ label: "At risk", cls: "at-risk" });
  });

  it("labels an on-track block once every badge is met", () => {
    const block = computeAccountReadiness(ageReq, { now: NOW, launchAt: inDays(60) })!;
    expect(readinessChip(block)).toEqual({ label: "On track", cls: "met" });
  });

  it("falls back to the requirement level when timing is unknown", () => {
    expect(readinessChip(computeAccountReadiness(ageReq, { now: NOW })!)).toEqual({
      label: "Required",
      cls: "info",
    });
    expect(readinessChip(computeAccountReadiness(karmaReq, { now: NOW })!)).toEqual({
      label: "Recommended",
      cls: "info",
    });
  });
});
