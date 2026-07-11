import { describe, it, expect } from "vitest";
import {
  DEMO_RECS,
  DEMO_KIT,
  DEMO_RESULTS,
  DEMO_SELF_REPORT,
} from "./demoData";

/**
 * The demo dataset renders through the real app components, so its numbers must
 * be internally coherent — a founder walking the tour should never spot a total
 * that doesn't add up. These are the invariants the pages rely on.
 */
describe("demoData", () => {
  const BAN = new Set(["LOW", "MEDIUM", "HIGH"]);

  it("every rec is a valid, non-empty recommendation", () => {
    expect(DEMO_RECS.length).toBeGreaterThanOrEqual(3);
    for (const r of DEMO_RECS) {
      expect(BAN.has(r.banRisk)).toBe(true);
      expect(r.fitScore).toBeGreaterThan(0);
      expect(r.fitScore).toBeLessThanOrEqual(100);
      expect(r.whyText.trim().length).toBeGreaterThan(0);
      expect(r.channelName.trim().length).toBeGreaterThan(0);
    }
  });

  it("recs are ranked like the real plan — fit descending, HIGH risk never leads", () => {
    // The product ranks by fit within non-HIGH risk and demotes HIGH below every
    // non-HIGH channel (see compareRecs in lib/launchChecker). So the invariants
    // are: fit is non-increasing, and no HIGH-risk rec precedes a non-HIGH one.
    for (let i = 1; i < DEMO_RECS.length; i++) {
      expect(DEMO_RECS[i].fitScore).toBeLessThanOrEqual(DEMO_RECS[i - 1].fitScore);
    }
    const firstHigh = DEMO_RECS.findIndex((r) => r.banRisk === "HIGH");
    const lastNonHigh = DEMO_RECS.map((r) => r.banRisk).lastIndexOf("MEDIUM");
    if (firstHigh !== -1) expect(firstHigh).toBeGreaterThan(lastNonHigh);
  });

  it("the launch kit has a draft for every rec, with a storyboard for short-form", () => {
    expect(DEMO_KIT.recs.length).toBe(DEMO_RECS.length);
    for (const k of DEMO_KIT.recs) {
      expect(k.draft).not.toBeNull();
      expect(k.draft?.body.trim().length).toBeGreaterThan(0);
      // Short-form channels carry a shootable storyboard; text channels don't.
      expect(k.draft?.storyboard != null).toBe(k.shortform);
    }
  });

  it("results reconcile: per-channel rows sum to the headline totals", () => {
    const sum = (pick: (c: (typeof DEMO_RESULTS.perChannel)[number]) => number) =>
      DEMO_RESULTS.perChannel.reduce((n, c) => n + pick(c), 0);

    expect(sum((c) => c.clicks)).toBe(DEMO_RESULTS.totalClicks);
    expect(sum((c) => c.signups)).toBe(DEMO_RESULTS.totalSignups);
    expect(sum((c) => c.revenueCents)).toBe(DEMO_RESULTS.totalRevenueCents);
  });

  it("the ROI headline matches the totals it summarizes", () => {
    expect(DEMO_RESULTS.roi.clicks).toBe(DEMO_RESULTS.totalClicks);
    expect(DEMO_RESULTS.roi.signups).toBe(DEMO_RESULTS.totalSignups);
    expect(DEMO_RESULTS.roi.revenueCents).toBe(DEMO_RESULTS.totalRevenueCents);
    expect(DEMO_RESULTS.perPost.length).toBe(DEMO_RESULTS.perChannel.length);
  });

  it("self-report rollup is internally consistent", () => {
    const r = DEMO_SELF_REPORT;
    expect(r.bySource.reduce((n, s) => n + s.count, 0)).toBe(r.total);
    expect(r.trackedCount + r.darkSocialCount).toBe(r.total);
    expect(r.agreeCount + r.disagreeCount).toBeLessThanOrEqual(r.reconciledCount);
  });
});
