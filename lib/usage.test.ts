import { describe, it, expect } from "vitest";
import { utcDay, isOverBudget } from "./usage";

describe("utcDay", () => {
  it("formats a timestamp as a UTC YYYY-MM-DD day", () => {
    expect(utcDay(Date.UTC(2026, 6, 2, 13, 45))).toBe("2026-07-02");
  });

  it("rolls to the next day at UTC midnight, not local", () => {
    // 23:30 UTC and 00:30 UTC (next day) are different budget days.
    expect(utcDay(Date.UTC(2026, 6, 2, 23, 30))).toBe("2026-07-02");
    expect(utcDay(Date.UTC(2026, 6, 3, 0, 30))).toBe("2026-07-03");
  });
});

describe("isOverBudget", () => {
  it("is true only at or above the cap", () => {
    expect(isOverBudget(0, 200_000)).toBe(false);
    expect(isOverBudget(199_999, 200_000)).toBe(false);
    expect(isOverBudget(200_000, 200_000)).toBe(true);
    expect(isOverBudget(250_000, 200_000)).toBe(true);
  });
});
