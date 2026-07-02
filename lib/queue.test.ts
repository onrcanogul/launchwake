import { describe, it, expect } from "vitest";
import { buildCadence, dueLabel, addDays, PHASE_ORDER, PHASES } from "./queue";

const START = new Date("2026-07-02T00:00:00Z");

describe("buildCadence", () => {
  it("schedules each phase at its offset, capped, in cadence order", () => {
    const specs = buildCadence(START, {
      CHANGELOG: [{ id: "devto" }],
      DIRECTORIES: [{ id: "d1" }, { id: "d2" }, { id: "d3" }, { id: "d4" }, { id: "d5" }],
      NEWSLETTERS: [{ id: "n1" }],
      SUBREDDITS: [{ id: "s1" }],
      SHOW_HN_RELAUNCH: [{ id: "hn" }],
    });

    // DIRECTORIES capped at 4.
    expect(specs.filter((s) => s.phase === "DIRECTORIES")).toHaveLength(4);

    // Order follows PHASE_ORDER.
    const firstOfEach = PHASE_ORDER.map((p) => specs.find((s) => s.phase === p));
    expect(firstOfEach.every(Boolean)).toBe(true);

    // Offsets land on the right days.
    const changelog = specs.find((s) => s.phase === "CHANGELOG")!;
    const dirs = specs.find((s) => s.phase === "DIRECTORIES")!;
    const relaunch = specs.find((s) => s.phase === "SHOW_HN_RELAUNCH")!;
    expect(changelog.dueAt.getTime()).toBe(START.getTime());
    expect(dirs.dueAt.getTime()).toBe(addDays(START, PHASES.DIRECTORIES.offsetDays).getTime());
    expect(relaunch.dueAt.getTime()).toBe(addDays(START, 90).getTime());
  });

  it("skips phases with no channels", () => {
    const specs = buildCadence(START, { DIRECTORIES: [{ id: "d1" }] });
    expect(specs).toHaveLength(1);
    expect(specs[0].phase).toBe("DIRECTORIES");
  });
});

describe("dueLabel", () => {
  const now = new Date("2026-07-02T12:00:00Z");
  it("labels relative timing in human terms", () => {
    expect(dueLabel(new Date("2026-07-02T18:00:00Z"), now)).toBe("Due today");
    expect(dueLabel(new Date("2026-07-03T18:00:00Z"), now)).toBe("Due tomorrow");
    expect(dueLabel(new Date("2026-07-06T12:00:00Z"), now)).toMatch(/Due in 4d/);
    expect(dueLabel(new Date("2026-07-18T12:00:00Z"), now)).toMatch(/In ~2w/);
    expect(dueLabel(new Date("2026-10-01T12:00:00Z"), now)).toMatch(/In ~3mo/);
  });
  it("flags overdue tasks", () => {
    expect(dueLabel(new Date("2026-06-30T12:00:00Z"), now)).toMatch(/2d overdue/);
  });
});

describe("PHASES", () => {
  it("covers every phase in the enum order with sane offsets", () => {
    expect(PHASE_ORDER.map((p) => PHASES[p].offsetDays)).toEqual([0, 2, 9, 16, 90]);
    // Each phase maps to at least one catalog platform.
    for (const p of PHASE_ORDER) expect(PHASES[p].platforms.length).toBeGreaterThan(0);
  });
});
