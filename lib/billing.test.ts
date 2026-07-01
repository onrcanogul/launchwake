import { describe, it, expect } from "vitest";
import { entitlementViolation, type PlanUsage } from "./billing";

const free = (over: Partial<PlanUsage> = {}): PlanUsage => ({
  plan: "FREE",
  projectCount: 0,
  projectLimit: 1,
  plansThisMonth: 0,
  planLimit: 2,
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
  it("never blocks Pro (unlimited)", () => {
    const pro: PlanUsage = {
      plan: "PRO",
      projectCount: 9,
      projectLimit: null,
      plansThisMonth: 99,
      planLimit: null,
    };
    expect(entitlementViolation(pro, "create_project")).toBeNull();
    expect(entitlementViolation(pro, "create_plan")).toBeNull();
  });
});
