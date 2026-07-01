import { describe, it, expect } from "vitest";
import { nextBestTime, buildICS } from "./reminders";

// A fixed reference: Monday 2026-07-06 12:00 UTC.
const MON = new Date("2026-07-06T12:00:00Z");

describe("nextBestTime", () => {
  it("finds the next day in a range at the given hour", () => {
    // Tue–Thu 8am → next Tuesday (2026-07-07) 08:00
    const w = nextBestTime("Tue–Thu 8am ET", MON)!;
    expect(w).toMatchObject({ year: 2026, month: 7, day: 7, hour: 8, minute: 0 });
  });

  it("parses slash-separated days and 24h times", () => {
    // Mon/Wed 9am → Monday already 12:00 passed, so next Wednesday (07-08) 09:00
    const w = nextBestTime("Mon/Wed 9am ET", MON)!;
    expect(w).toMatchObject({ day: 8, hour: 9 });
  });

  it("handles 00:01 style times", () => {
    // Tue 00:01 PT → Tuesday 07-07 00:01
    const w = nextBestTime("Tue 00:01 PT", MON)!;
    expect(w).toMatchObject({ day: 7, hour: 0, minute: 1 });
  });

  it("defaults weekday mornings to 9am", () => {
    const w = nextBestTime("Weekday mornings", MON)!;
    expect(w.hour).toBe(9);
    expect([1, 2, 3, 4, 5]).toContain(new Date(Date.UTC(w.year, w.month - 1, w.day)).getUTCDay());
  });

  it("returns null for unschedulable strings", () => {
    expect(nextBestTime("Invite only", MON)).toBeNull();
    expect(nextBestTime(null, MON)).toBeNull();
  });
});

describe("buildICS", () => {
  it("produces a valid single-event calendar", () => {
    const ics = buildICS({
      uid: "u1@launchwake.dev",
      title: "Post to Hacker News",
      description: "Best time; you post it yourself.",
      start: { year: 2026, month: 7, day: 7, hour: 8, minute: 0 },
      stamp: "20260706T120000Z",
    });
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("DTSTART:20260707T080000");
    expect(ics).toContain("DTEND:20260707T083000");
    expect(ics).toContain("SUMMARY:Post to Hacker News");
    expect(ics).toContain("END:VCALENDAR");
  });
});
