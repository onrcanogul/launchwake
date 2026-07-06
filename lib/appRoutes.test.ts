import { describe, it, expect } from "vitest";
import {
  sectionRest,
  switchTarget,
  pickActiveProjectId,
  toQuery,
} from "./appRoutes";

describe("sectionRest", () => {
  it("strips the /app/[project] prefix", () => {
    expect(sectionRest("/app/proj_1")).toBe("");
    expect(sectionRest("/app/proj_1/results")).toBe("/results");
    expect(sectionRest("/app/proj_1/ships/ship_9/plan")).toBe("/ships/ship_9/plan");
    expect(sectionRest("/app/proj_1/ships/new")).toBe("/ships/new");
  });
});

describe("switchTarget", () => {
  it("preserves a project-wide section (the required case)", () => {
    // /app/A/results → /app/B/results
    expect(switchTarget("B", sectionRest("/app/A/results"))).toBe("/app/B/results");
    for (const s of ["channels", "radar", "settings"]) {
      expect(switchTarget("B", `/${s}`)).toBe(`/app/B/${s}`);
    }
  });

  it("keeps the new-ship form across projects", () => {
    expect(switchTarget("B", "/ships/new")).toBe("/app/B/ships/new");
  });

  it("maps a ship-scoped deep link down to its bare section", () => {
    // The ship id is meaningless in project B → land on B's select-a-ship page.
    expect(switchTarget("B", "/ships/ship_9/plan")).toBe("/app/B/plan");
    expect(switchTarget("B", "/ships/ship_9/kit")).toBe("/app/B/kit");
    expect(switchTarget("B", "/ships/ship_9/launch")).toBe("/app/B/launch");
  });

  it("falls back to the feed for the root and sections with no bare page", () => {
    expect(switchTarget("B", "")).toBe("/app/B");
    // readiness/retro/schedule only exist per-ship → target project's feed.
    expect(switchTarget("B", "/ships/ship_9/readiness")).toBe("/app/B");
    expect(switchTarget("B", "/ships/ship_9/retro")).toBe("/app/B");
  });

  it("preserves the bare ship sections themselves", () => {
    expect(switchTarget("B", "/plan")).toBe("/app/B/plan");
    expect(switchTarget("B", "/queue")).toBe("/app/B/queue");
  });
});

describe("pickActiveProjectId", () => {
  const owned = ["p_old", "p_mid", "p_new"]; // oldest first

  it("prefers the requested id when the account owns it", () => {
    expect(pickActiveProjectId(owned, "p_mid", "p_new")).toBe("p_mid");
  });

  it("ignores a requested id the account does not own", () => {
    // Someone else's / a stale id must never be honored — fall through to cookie.
    expect(pickActiveProjectId(owned, "p_other", "p_new")).toBe("p_new");
  });

  it("falls back to the cookie's last-active project when owned", () => {
    expect(pickActiveProjectId(owned, null, "p_mid")).toBe("p_mid");
  });

  it("ignores a tampered cookie value and uses the oldest project", () => {
    expect(pickActiveProjectId(owned, null, "p_evil")).toBe("p_old");
  });

  it("uses the oldest project when nothing is requested or remembered", () => {
    expect(pickActiveProjectId(owned, null, null)).toBe("p_old");
    expect(pickActiveProjectId(owned, undefined, null)).toBe("p_old");
  });

  it("returns null when the account has no projects (→ onboarding)", () => {
    expect(pickActiveProjectId([], "p_mid", "p_mid")).toBeNull();
  });

  it("single-project accounts always resolve to that one project", () => {
    expect(pickActiveProjectId(["only"], null, null)).toBe("only");
    expect(pickActiveProjectId(["only"], "spoof", "spoof")).toBe("only");
  });
});

describe("toQuery", () => {
  it("builds a query suffix, preserving the value and dropping empties", () => {
    expect(toQuery({})).toBe("");
    expect(toQuery({ rec: "rec_1" })).toBe("?rec=rec_1");
    expect(toQuery({ upgraded: "1" })).toBe("?upgraded=1");
    expect(toQuery({ a: undefined, b: "x" })).toBe("?b=x");
  });

  it("expands array params", () => {
    expect(toQuery({ tag: ["a", "b"] })).toBe("?tag=a&tag=b");
  });
});
