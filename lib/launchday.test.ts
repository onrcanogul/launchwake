import { describe, it, expect } from "vitest";
import { buildLaunchTimeline, groupByWindow } from "./launchday";

type Rec = { id: string; bestTime: string | null };

const recs: Rec[] = [
  { id: "queued", bestTime: "Anytime (queued)" },
  { id: "hn", bestTime: "Tue–Thu 8am ET" },
  { id: "ph", bestTime: "Tue 00:01 PT" },
  { id: "reddit", bestTime: "Weekday mornings ET" },
  { id: "linkedin", bestTime: "Tue–Thu 10am ET" },
  { id: "weekly", bestTime: "Weekly (Friday)" },
];

describe("buildLaunchTimeline", () => {
  const timeline = buildLaunchTimeline(recs);
  const orderOf = (id: string) => timeline.findIndex((s) => s.rec.id === id);

  it("orders clock-timed channels earliest-first, flexible ones last", () => {
    // 00:01 < 8:00 < 9:00 (morning) < 10:00, then the two untimed ones.
    expect(orderOf("ph")).toBeLessThan(orderOf("hn"));
    expect(orderOf("hn")).toBeLessThan(orderOf("reddit"));
    expect(orderOf("reddit")).toBeLessThan(orderOf("linkedin"));
    expect(orderOf("linkedin")).toBeLessThan(orderOf("queued"));
    expect(orderOf("linkedin")).toBeLessThan(orderOf("weekly"));
  });

  it("formats clock labels with the timezone", () => {
    expect(timeline.find((s) => s.rec.id === "ph")!.timeLabel).toBe("12:01 AM PT");
    expect(timeline.find((s) => s.rec.id === "hn")!.timeLabel).toBe("8:00 AM ET");
    expect(timeline.find((s) => s.rec.id === "reddit")!.timeLabel).toBe("9:00 AM ET");
  });

  it("keeps the original phrase for untimed channels", () => {
    expect(timeline.find((s) => s.rec.id === "queued")!.timeLabel).toBe("Anytime (queued)");
    expect(timeline.find((s) => s.rec.id === "weekly")!.timeLabel).toBe("Weekly (Friday)");
  });

  it("assigns windows by hour", () => {
    const w = (id: string) => timeline.find((s) => s.rec.id === id)!.window;
    expect(w("ph")).toBe("early"); // 00:01
    expect(w("hn")).toBe("morning"); // 8am
    expect(w("linkedin")).toBe("morning"); // 10am
    expect(w("queued")).toBe("flexible");
    expect(w("weekly")).toBe("flexible");
  });

  it("preserves incoming order among flexible channels", () => {
    // queued comes before weekly in the input, so it stays first in flexible.
    expect(orderOf("queued")).toBeLessThan(orderOf("weekly"));
  });

  it("handles a null bestTime as flexible/Anytime", () => {
    const [step] = buildLaunchTimeline([{ id: "x", bestTime: null }]);
    expect(step.window).toBe("flexible");
    expect(step.timeLabel).toBe("Anytime");
  });
});

describe("groupByWindow", () => {
  it("returns only non-empty windows, in display order", () => {
    const groups = groupByWindow(buildLaunchTimeline(recs));
    const windows = groups.map((g) => g.window);
    // early → morning → (midday) → flexible, filtered + ordered.
    expect(windows[0]).toBe("early");
    expect(windows).toContain("morning");
    expect(windows[windows.length - 1]).toBe("flexible");
    // total steps preserved
    expect(groups.reduce((n, g) => n + g.steps.length, 0)).toBe(recs.length);
  });
});
