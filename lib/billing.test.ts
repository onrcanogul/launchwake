import { describe, it, expect } from "vitest";
import {
  entitlementViolation,
  clampSeats,
  teamPriceCents,
  isPaidPlan,
  TEAM_MIN_SEATS,
  TEAM_MAX_SEATS,
  TEAM_PRICE_PER_SEAT_CENTS,
  type PlanUsage,
} from "./billing";

const free = (over: Partial<PlanUsage> = {}): PlanUsage => ({
  plan: "FREE",
  seats: 1,
  projectCount: 0,
  projectLimit: 1,
  plansThisMonth: 0,
  planLimit: 2,
  ...over,
});

const paid = (plan: "PRO" | "TEAM", over: Partial<PlanUsage> = {}): PlanUsage => ({
  plan,
  seats: plan === "TEAM" ? 3 : 1,
  projectCount: 9,
  projectLimit: null,
  plansThisMonth: 99,
  planLimit: null,
  ...over,
});

describe("entitlementViolation", () => {
  it("allows a first project on Free", () => {
    expect(entitlementViolation(free(), "create_project")).toBeNull();
  });
  it("blocks a second project on Free", () => {
    expect(
      entitlementViolation(free({ projectCount: 1 }), "create_project"),
    ).toMatch(/Upgrade to Pro/);
  });
  it("allows plans until the monthly cap", () => {
    expect(entitlementViolation(free({ plansThisMonth: 1 }), "create_plan")).toBeNull();
    expect(
      entitlementViolation(free({ plansThisMonth: 2 }), "create_plan"),
    ).toMatch(/2\/2/);
  });
  it("never blocks Pro or Team (unlimited)", () => {
    for (const plan of ["PRO", "TEAM"] as const) {
      expect(entitlementViolation(paid(plan), "create_project")).toBeNull();
      expect(entitlementViolation(paid(plan), "create_plan")).toBeNull();
    }
  });
});

describe("isPaidPlan", () => {
  it("treats Pro and Team as paid, Free as not", () => {
    expect(isPaidPlan("FREE")).toBe(false);
    expect(isPaidPlan("PRO")).toBe(true);
    expect(isPaidPlan("TEAM")).toBe(true);
  });
});

describe("clampSeats", () => {
  it("enforces the seat floor and ceiling", () => {
    expect(clampSeats(1)).toBe(TEAM_MIN_SEATS);
    expect(clampSeats(TEAM_MIN_SEATS)).toBe(TEAM_MIN_SEATS);
    expect(clampSeats(5)).toBe(5);
    expect(clampSeats(9999)).toBe(TEAM_MAX_SEATS);
    expect(clampSeats(NaN)).toBe(TEAM_MIN_SEATS);
  });
  it("rounds fractional seats", () => {
    expect(clampSeats(4.6)).toBe(5);
  });
});

describe("teamPriceCents", () => {
  it("is per-seat with a minimum (raises ARPU with seats)", () => {
    expect(teamPriceCents(3)).toBe(3 * TEAM_PRICE_PER_SEAT_CENTS); // $87 at $29/seat
    expect(teamPriceCents(1)).toBe(TEAM_MIN_SEATS * TEAM_PRICE_PER_SEAT_CENTS); // floored to 3
    expect(teamPriceCents(10)).toBe(10 * TEAM_PRICE_PER_SEAT_CENTS);
  });
});
