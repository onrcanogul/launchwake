import { describe, it, expect } from "vitest";
import { weeklyRecommendations, buildDigest, type WeeklyStats } from "./digest";

function stats(over: Partial<WeeklyStats> = {}): WeeklyStats {
  return {
    clicks: 0,
    signups: 0,
    revenueCents: 0,
    currency: "usd",
    topChannel: null,
    shipsLastWeek: 0,
    postsLastWeek: 0,
    leaky: [],
    undistributed: [],
    undistributedCount: 0,
    ...over,
  };
}

describe("weeklyRecommendations", () => {
  it("nudges to distribute a shipped-but-unposted release", () => {
    const recs = weeklyRecommendations(stats({ undistributed: [{ title: "v1.0", channels: 8 }] }));
    expect(recs[0]).toMatch(/Distribute "v1\.0"/);
    expect(recs[0]).toMatch(/8 channels/);
  });

  it("flags a channel that leaked traffic", () => {
    const recs = weeklyRecommendations(stats({ leaky: [{ channel: "r/SaaS", clicks: 40 }] }));
    expect(recs.some((r) => /r\/SaaS drove 40 clicks but no signups/.test(r))).toBe(true);
  });

  it("nudges a newsletter follow-up when a pitch has gone quiet", () => {
    const recs = weeklyRecommendations(
      stats({ followUpPitches: [{ channelName: "Console.dev", shipTitle: "v1", sentAt: new Date() }] }),
    );
    expect(recs.some((r) => /Follow up on your Console\.dev pitch/.test(r))).toBe(true);
  });

  it("leads with this week's queue tasks when any are due", () => {
    const recs = weeklyRecommendations(
      stats({
        queuedTasks: [
          { phase: "DIRECTORIES", phaseLabel: "Submit to directories", channelName: "AlternativeTo", shipTitle: "v1", url: "https://alternativeto.net", dueAt: new Date() },
          { phase: "DIRECTORIES", phaseLabel: "Submit to directories", channelName: "SaaSHub", shipTitle: "v1", url: null, dueAt: new Date() },
        ],
      }),
    );
    expect(recs[0]).toMatch(/This week's queue/);
    expect(recs[0]).toMatch(/AlternativeTo/);
    expect(recs[0]).toMatch(/\+1 more task/);
  });

  it("leads with warm Intent Radar leads when there are any", () => {
    const recs = weeklyRecommendations(stats({ intentMatches: 3, undistributed: [{ title: "v1", channels: 2 }] }));
    expect(recs[0]).toMatch(/3 people asked for a tool like yours/);
    expect(recs[0]).toMatch(/Intent Radar/);
  });

  it("re-engages on a quiet week", () => {
    const recs = weeklyRecommendations(stats({ postsLastWeek: 0, shipsLastWeek: 0, topChannel: "Show HN" }));
    expect(recs.some((r) => /Quiet week/.test(r) && /Show HN/.test(r))).toBe(true);
  });

  it("falls back to a next-step when there's nothing to flag", () => {
    expect(weeklyRecommendations(stats({ postsLastWeek: 1, signups: 3, topChannel: "dev.to" }))[0]).toMatch(
      /Do more of what worked/,
    );
    expect(weeklyRecommendations(stats({ postsLastWeek: 1, signups: 0 }))[0]).toMatch(/tracking pixel/);
  });

  it("caps at three recommendations", () => {
    const recs = weeklyRecommendations(
      stats({ undistributed: [{ title: "a", channels: 1 }], leaky: [{ channel: "x", clicks: 20 }], postsLastWeek: 0, shipsLastWeek: 0 }),
    );
    expect(recs.length).toBeLessThanOrEqual(3);
  });
});

describe("buildDigest", () => {
  const email = buildDigest({
    projectName: "Hookline",
    appUrl: "https://launchwake.com",
    stats: stats({ clicks: 340, signups: 41, revenueCents: 34000, topChannel: "Show HN", shipsLastWeek: 1, postsLastWeek: 2 }),
    radar: { subject: "s", text: "• [HN] Rival · 180 pts" },
  });

  it("headlines the week in the subject", () => {
    expect(email.subject).toMatch(/41 signups from 340 clicks/);
  });

  it("leads the subject with unannounced ships when any are shipped-but-unposted", () => {
    const e = buildDigest({
      projectName: "Hookline",
      appUrl: "https://launchwake.com",
      stats: stats({ undistributedCount: 2, undistributed: [{ title: "v1.0", channels: 8 }] }),
    });
    expect(e.subject).toMatch(/2 ships shipped, 0 announced/);
  });

  it("singularizes one unannounced ship", () => {
    const e = buildDigest({
      projectName: "Hookline",
      appUrl: "https://launchwake.com",
      stats: stats({ undistributedCount: 1 }),
    });
    expect(e.subject).toMatch(/1 ship shipped, 0 announced/);
  });

  it("includes the sections, the numbers, and the radar", () => {
    expect(email.text).toContain("LAST WEEK");
    expect(email.text).toContain("340 clicks · 41 signups");
    expect(email.text).toContain("$340 revenue");
    expect(email.text).toContain("WHAT TO DO THIS WEEK");
    expect(email.text).toContain("LAUNCH RADAR");
    expect(email.text).toContain("Rival · 180 pts");
    expect(email.text).toContain("https://launchwake.com/app");
  });
});
