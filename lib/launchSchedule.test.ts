import { describe, expect, it } from "vitest";
import { buildLaunchSchedule, launchScheduleICS } from "./launchSchedule";

const LAUNCH = new Date(Date.UTC(2026, 6, 15, 12, 0)); // 2026-07-15 (noon, dropped)

const CHANNELS = [
  { name: "Product Hunt", bestTime: "Tue 00:01 PT" },
  { name: "Show HN", bestTime: "Tue–Thu 8am ET" },
  { name: "r/webdev", bestTime: "Anytime" },
];

describe("buildLaunchSchedule", () => {
  it("spans D-7 to D+2 in order", () => {
    const s = buildLaunchSchedule(LAUNCH, CHANNELS);
    expect(s.map((m) => m.offset)).toEqual([-7, -3, -1, 0, 1, 2]);
  });

  it("dates each milestone relative to the launch day (time-of-day dropped)", () => {
    const s = buildLaunchSchedule(LAUNCH, CHANNELS);
    const launch = s.find((m) => m.offset === 0)!;
    expect(launch.date.toISOString()).toBe("2026-07-15T00:00:00.000Z");
    const minus7 = s.find((m) => m.offset === -7)!;
    expect(minus7.date.toISOString()).toBe("2026-07-08T00:00:00.000Z");
    const plus2 = s.find((m) => m.offset === 2)!;
    expect(plus2.date.toISOString()).toBe("2026-07-17T00:00:00.000Z");
  });

  it("orders launch-day channels by best time (clock-timed before flexible)", () => {
    const launch = buildLaunchSchedule(LAUNCH, CHANNELS).find(
      (m) => m.offset === 0,
    )!;
    const names = launch.channels!.map((c) => c.name);
    // Both clock-timed venues come before the "Anytime" one.
    expect(names.indexOf("r/webdev")).toBe(2);
    expect(names).toContain("Product Hunt");
    expect(names).toContain("Show HN");
  });

  it("counts channels in the launch-day detail", () => {
    const launch = buildLaunchSchedule(LAUNCH, CHANNELS).find(
      (m) => m.offset === 0,
    )!;
    expect(launch.detail).toContain("3 channels");
  });
});

describe("launchScheduleICS", () => {
  it("emits one VCALENDAR with a VEVENT per milestone", () => {
    const s = buildLaunchSchedule(LAUNCH, CHANNELS);
    const ics = launchScheduleICS("ship1", "Launch: Hookline", s, "20260701T000000Z");
    expect(ics.startsWith("BEGIN:VCALENDAR")).toBe(true);
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
    const events = ics.match(/BEGIN:VEVENT/g) ?? [];
    expect(events).toHaveLength(s.length);
    // Deterministic dates present.
    expect(ics).toContain("DTSTART:20260715T090000");
  });
});
