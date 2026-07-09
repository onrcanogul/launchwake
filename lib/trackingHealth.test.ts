import { describe, it, expect } from "vitest";
import {
  deriveTrackingHealth,
  type TrackingHealthSignals,
} from "./trackingHealth";

const NOW = new Date("2026-07-04T12:00:00.000Z");
const RECENT = new Date("2026-07-04T11:59:00.000Z");

/** A fully-healthy signal set; override per test. */
function base(overrides: Partial<TrackingHealthSignals> = {}): TrackingHealthSignals {
  return {
    signups: 5,
    clicks: 20,
    lastSignupAt: RECENT,
    lastClickAt: RECENT,
    githubConfigured: true,
    githubLastSuccessAt: RECENT,
    stripeConfigured: true,
    stripeLastSuccessAt: RECENT,
    recentFailedGithub: 0,
    recentFailedStripe: 0,
    now: NOW,
    ...overrides,
  };
}

function item(h: ReturnType<typeof deriveTrackingHealth>, key: string) {
  const found = h.items.find((i) => i.key === key);
  if (!found) throw new Error(`missing item ${key}`);
  return found;
}

describe("deriveTrackingHealth — pixel", () => {
  it("is green once any signup has been received", () => {
    const h = deriveTrackingHealth(base({ signups: 3 }));
    expect(item(h, "pixel").level).toBe("green");
    expect(h.pixelInstalled).toBe(true);
  });

  it("is red when clicks arrive but no signups — the silent pixel failure", () => {
    const h = deriveTrackingHealth(base({ signups: 0, clicks: 12 }));
    const pixel = item(h, "pixel");
    expect(pixel.level).toBe("red");
    expect(pixel.fix).toMatch(/pixel/i);
    expect(h.pixelInstalled).toBe(false);
  });

  it("is amber (not red) when nothing has happened yet", () => {
    const h = deriveTrackingHealth(base({ signups: 0, clicks: 0 }));
    expect(item(h, "pixel").level).toBe("amber");
  });
});

describe("deriveTrackingHealth — pixel never fired / stale clicks", () => {
  it("tells the user the pixel never pinged when clicks arrive but it never fired", () => {
    const h = deriveTrackingHealth(base({ signups: 0, clicks: 8, pixelEverFired: false }));
    const pixel = item(h, "pixel");
    expect(pixel.level).toBe("red");
    expect(pixel.fix).toMatch(/never pinged/i);
  });

  it("distinguishes 'pixel live but launchwakeSignup() not firing' when it has pinged", () => {
    const h = deriveTrackingHealth(base({ signups: 0, clicks: 8, pixelEverFired: true }));
    expect(item(h, "pixel").fix).toMatch(/launchwakeSignup\(\) isn't firing/i);
  });

  it("notes a never-fired pixel even before any clicks (amber, not red)", () => {
    const h = deriveTrackingHealth(base({ signups: 0, clicks: 0, pixelEverFired: false }));
    const pixel = item(h, "pixel");
    expect(pixel.level).toBe("amber");
    expect(pixel.detail).toMatch(/never pinged/i);
  });

  it("escalates clicks-with-no-signups after 14+ days", () => {
    const h = deriveTrackingHealth(
      base({ signups: 0, clicks: 30, firstClickAt: new Date("2026-06-14T12:00:00.000Z") }),
    );
    const pixel = item(h, "pixel");
    expect(pixel.level).toBe("red");
    expect(pixel.detail).toMatch(/20 days/);
    expect(pixel.detail).toMatch(/not one signup/i);
  });

  it("does not escalate when clicks are recent (under 14 days)", () => {
    const h = deriveTrackingHealth(
      base({ signups: 0, clicks: 4, firstClickAt: new Date("2026-07-01T12:00:00.000Z") }),
    );
    expect(item(h, "pixel").detail).not.toMatch(/days/);
  });
});

describe("deriveTrackingHealth — dark-social share", () => {
  it("flags a high untracked share amber with a survey nudge", () => {
    const h = deriveTrackingHealth(base({ signups: 10, unattributedSignups: 6 }));
    const ds = item(h, "darksocial");
    expect(ds.level).toBe("amber");
    expect(ds.detail).toMatch(/6 of 10/);
    expect(ds.detail).toMatch(/60%/);
    expect(ds.fix).toMatch(/how did you hear/i);
  });

  it("reports a low untracked share green, with no fix", () => {
    const h = deriveTrackingHealth(base({ signups: 10, unattributedSignups: 2 }));
    const ds = item(h, "darksocial");
    expect(ds.level).toBe("green");
    expect(ds.fix).toBeUndefined();
  });

  it("omits the dark-social item entirely when everything is attributed", () => {
    const h = deriveTrackingHealth(base({ signups: 5, unattributedSignups: 0 }));
    expect(h.items.find((i) => i.key === "darksocial")).toBeUndefined();
  });
});

describe("deriveTrackingHealth — webhooks", () => {
  it("marks an unconnected integration amber, not red", () => {
    const h = deriveTrackingHealth(
      base({ githubConfigured: false, githubLastSuccessAt: null }),
    );
    expect(item(h, "github").level).toBe("amber");
    expect(item(h, "github").status).toMatch(/not connected/i);
  });

  it("marks a configured webhook with recent failures red", () => {
    const h = deriveTrackingHealth(base({ recentFailedGithub: 2 }));
    expect(item(h, "github").level).toBe("red");
  });

  it("is green when configured and a delivery has succeeded", () => {
    const h = deriveTrackingHealth(base());
    expect(item(h, "github").level).toBe("green");
    expect(item(h, "stripe").level).toBe("green");
  });

  it("is amber while configured but awaiting the first delivery", () => {
    const h = deriveTrackingHealth(
      base({ stripeLastSuccessAt: null, recentFailedStripe: 0 }),
    );
    expect(item(h, "stripe").level).toBe("amber");
    expect(item(h, "stripe").status).toMatch(/waiting/i);
  });
});

describe("deriveTrackingHealth — deliveries + overall", () => {
  it("sums recent failures across sources and flags the banner", () => {
    const h = deriveTrackingHealth(base({ recentFailedGithub: 1, recentFailedStripe: 2 }));
    expect(h.recentFailedDeliveries).toBe(3);
    expect(h.hasRedWebhookFailures).toBe(true);
    expect(item(h, "deliveries").level).toBe("red");
  });

  it("has no failures and no banner when clean", () => {
    const h = deriveTrackingHealth(base());
    expect(h.recentFailedDeliveries).toBe(0);
    expect(h.hasRedWebhookFailures).toBe(false);
    expect(item(h, "deliveries").level).toBe("green");
  });

  it("overall is the worst item level", () => {
    expect(deriveTrackingHealth(base()).overall).toBe("green");
    expect(
      deriveTrackingHealth(base({ stripeConfigured: false, stripeLastSuccessAt: null })).overall,
    ).toBe("amber");
    expect(deriveTrackingHealth(base({ recentFailedGithub: 1 })).overall).toBe("red");
  });
});
