import { describe, it, expect } from "vitest";
import {
  nextBestTime,
  nextBestTimeUTC,
  reminderMessage,
  buildICS,
} from "./reminders";

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

describe("nextBestTimeUTC", () => {
  it("converts 'Tue–Thu 8am ET' to the correct UTC instant", () => {
    // ET summer = UTC-4, so 8am ET = 12:00 UTC on the next Tuesday.
    const d = nextBestTimeUTC("Tue–Thu 8am ET", MON)!;
    expect(d.toISOString()).toBe("2026-07-07T12:00:00.000Z");
  });
  it("converts 'Tue 00:01 PT' correctly", () => {
    // PT summer = UTC-7, so 00:01 PT = 07:01 UTC.
    const d = nextBestTimeUTC("Tue 00:01 PT", MON)!;
    expect(d.toISOString()).toBe("2026-07-07T07:01:00.000Z");
  });
  it("returns null for unschedulable strings", () => {
    expect(nextBestTimeUTC("Invite only", MON)).toBeNull();
  });
});

describe("reminderMessage", () => {
  it("builds subject + text with the draft link, reminder-only", () => {
    const { subject, text } = reminderMessage(
      {
        shipId: "s1",
        channelName: "Hacker News — Show HN",
        shipTitle: "Slack alerts",
        bestTimeLabel: "Tue–Thu 8am ET",
        ruleNote: "build story, no marketing",
      },
      "https://launchwake.dev",
    );
    expect(subject).toContain("Slack alerts");
    expect(subject).toContain("Hacker News");
    expect(text).toContain("https://launchwake.dev/app/ships/s1/kit");
    expect(text).toMatch(/reminder only/i);
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
