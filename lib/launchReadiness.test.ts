import { describe, expect, it } from "vitest";
import { computeReadiness, READY_THRESHOLD, type ReadinessInput } from "./launchReadiness";

const NONE: ReadinessInput = {
  trackingLive: false,
  hasProductUrl: false,
  hasDescription: false,
  hasPlan: false,
  channelCount: 0,
  draftCount: 0,
  scheduled: false,
};

const ALL: ReadinessInput = {
  trackingLive: true,
  hasProductUrl: true,
  hasDescription: true,
  hasPlan: true,
  channelCount: 3,
  draftCount: 3,
  scheduled: true,
};

describe("computeReadiness", () => {
  it("scores 0 and is not ready when nothing is done", () => {
    const r = computeReadiness(NONE);
    expect(r.score).toBe(0);
    expect(r.ready).toBe(false);
    expect(r.items.every((i) => !i.done)).toBe(true);
  });

  it("scores 100 and is ready when everything is done", () => {
    const r = computeReadiness(ALL);
    expect(r.score).toBe(100);
    expect(r.ready).toBe(true);
  });

  it("weights total exactly 100", () => {
    const total = computeReadiness(NONE).items.reduce((s, i) => s + i.weight, 0);
    expect(total).toBe(100);
  });

  it("makes the tracking snippet the single heaviest item", () => {
    const { items } = computeReadiness(NONE);
    const tracking = items.find((i) => i.key === "tracking")!;
    const maxOther = Math.max(
      ...items.filter((i) => i.key !== "tracking").map((i) => i.weight),
    );
    expect(tracking.weight).toBeGreaterThan(maxOther);
  });

  it("adds only the completed item's weight to the score", () => {
    const r = computeReadiness({ ...NONE, trackingLive: true });
    const tracking = r.items.find((i) => i.key === "tracking")!;
    expect(r.score).toBe(tracking.weight);
    expect(tracking.done).toBe(true);
  });

  it("crosses the ready threshold once enough weight is complete", () => {
    // Everything except tracking: 12+18+12+10+8+6 = 66 (< 70) → not ready,
    // proving attribution is required to be launch-ready.
    const withoutTracking = computeReadiness({ ...ALL, trackingLive: false });
    expect(withoutTracking.score).toBeLessThan(READY_THRESHOLD);
    expect(withoutTracking.ready).toBe(false);

    const withTracking = computeReadiness({ ...NONE, trackingLive: true, hasPlan: true, channelCount: 2 });
    // 34 + 18 + 12 = 64 (< 70) still not ready — needs a bit more.
    expect(withTracking.ready).toBe(false);
  });
});
