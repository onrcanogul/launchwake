import { describe, it, expect } from "vitest";
import {
  dueDripStep,
  buildWelcomeEmail,
  buildPixelSetupEmail,
  buildLaunchNudgeEmail,
  buildDripEmail,
  type DripState,
  type DripStep,
} from "./drip";

function state(over: Partial<DripState> = {}): DripState {
  return { ageDays: 0, hasPixel: false, hasPublishedPost: false, alreadySent: [], ...over };
}

const CTX = {
  projectName: "Hookline",
  name: "Sam",
  appUrl: "https://launchwake.com/",
  unsubscribeUrl: "https://launchwake.com/api/email/unsubscribe?u=u1&t=tok",
};

describe("dueDripStep", () => {
  it("welcomes a brand-new account", () => {
    expect(dueDripStep(state({ ageDays: 0 }))).toBe("DRIP_WELCOME");
  });

  it("never re-sends a step already sent", () => {
    expect(dueDripStep(state({ ageDays: 0.5, alreadySent: ["DRIP_WELCOME"] }))).toBeNull();
  });

  it("sends the pixel nudge on day 2 only when no pixel is installed", () => {
    expect(dueDripStep(state({ ageDays: 3, hasPixel: false }))).toBe("DRIP_PIXEL");
    expect(dueDripStep(state({ ageDays: 3, hasPixel: true }))).toBeNull();
  });

  it("sends the launch nudge on day 7 only when nothing is posted", () => {
    expect(dueDripStep(state({ ageDays: 8, hasPublishedPost: false }))).toBe("DRIP_LAUNCH");
    expect(dueDripStep(state({ ageDays: 8, hasPublishedPost: true }))).toBeNull();
  });

  it("never back-blasts an old account (past every window)", () => {
    // 100-day-old account, nothing sent, no pixel, no post → still nothing.
    expect(
      dueDripStep(state({ ageDays: 100, hasPixel: false, hasPublishedPost: false })),
    ).toBeNull();
  });

  it("skips the welcome once its window closes (age ≥ 2), even if never sent", () => {
    expect(dueDripStep(state({ ageDays: 2, alreadySent: [], hasPixel: true }))).toBeNull();
  });

  it("goes quiet between windows (day 5–7 gap)", () => {
    expect(
      dueDripStep(state({ ageDays: 6, hasPixel: false, hasPublishedPost: false })),
    ).toBeNull();
  });
});

describe("drip email builders", () => {
  it("welcome: greets by name, has one clear next step + unsubscribe", () => {
    const e = buildWelcomeEmail(CTX);
    expect(e.subject).toMatch(/Welcome to LaunchWake/);
    expect(e.text).toContain("Welcome, Sam");
    expect(e.text).toContain("YOUR FIRST STEP");
    expect(e.text).toContain("https://launchwake.com/app");
    expect(e.text).not.toContain("com//app");
    expect(e.text).toContain(CTX.unsubscribeUrl);
  });

  it("pixel: points at the setup guide", () => {
    const e = buildPixelSetupEmail(CTX);
    expect(e.subject).toMatch(/signup tracking/i);
    expect(e.text).toContain("INSTALL THE TRACKING PIXEL");
    expect(e.text).toContain("https://launchwake.com/app/settings");
    expect(e.text).toContain(CTX.unsubscribeUrl);
  });

  it("launch: nudges to the launch kit", () => {
    const e = buildLaunchNudgeEmail(CTX);
    expect(e.subject).toMatch(/launch kit/i);
    expect(e.text).toContain("OPEN YOUR LAUNCH KIT");
    expect(e.text).toContain(CTX.unsubscribeUrl);
  });

  it("buildDripEmail dispatches on the step", () => {
    const steps: DripStep[] = ["DRIP_WELCOME", "DRIP_PIXEL", "DRIP_LAUNCH"];
    for (const s of steps) expect(buildDripEmail(s, CTX).subject.length).toBeGreaterThan(0);
    expect(buildDripEmail("DRIP_WELCOME", CTX).subject).toBe(buildWelcomeEmail(CTX).subject);
  });
});
