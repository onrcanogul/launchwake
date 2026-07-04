import { describe, it, expect } from "vitest";
import { trackingHealthRows, type TrackingHealthInput } from "./trackingHealth";

const noFailure = { failures: 0, lastFailureAt: null, lastError: null };

function base(over: Partial<TrackingHealthInput> = {}): TrackingHealthInput {
  return {
    clicks: 0,
    signups: 0,
    lastClickAt: null,
    lastSignupAt: null,
    github: { connected: false, lastSuccessAt: null, failure: noFailure },
    stripe: { configured: false, lastSuccessAt: null, failure: noFailure },
    ...over,
  };
}

function row(rows: ReturnType<typeof trackingHealthRows>, key: string) {
  return rows.find((r) => r.key === key)!;
}

describe("trackingHealthRows", () => {
  it("is all idle for a brand-new project", () => {
    const rows = trackingHealthRows(base());
    expect(rows.map((r) => r.key)).toEqual(["clicks", "pixel", "github", "stripe"]);
    expect(rows.every((r) => r.tone === "idle")).toBe(true);
  });

  it("marks click tracking ok with the last click time", () => {
    const at = new Date("2026-07-04T10:00:00Z");
    const rows = trackingHealthRows(base({ clicks: 12, lastClickAt: at }));
    expect(row(rows, "clicks").tone).toBe("ok");
    expect(row(rows, "clicks").detail).toContain("12 clicks");
    expect(row(rows, "clicks").at).toEqual(at);
  });

  it("warns when clicks arrive but the pixel never fires", () => {
    const rows = trackingHealthRows(base({ clicks: 20, signups: 0 }));
    expect(row(rows, "pixel").tone).toBe("warn");
    expect(row(rows, "pixel").detail).toMatch(/success page/);
  });

  it("marks the pixel ok once a signup is attributed", () => {
    const at = new Date("2026-07-04T11:00:00Z");
    const rows = trackingHealthRows(
      base({ clicks: 20, signups: 3, lastSignupAt: at }),
    );
    expect(row(rows, "pixel").tone).toBe("ok");
    expect(row(rows, "pixel").detail).toContain("3 signups");
    expect(row(rows, "pixel").at).toEqual(at);
  });

  it("shows a GitHub webhook failure with the error and failure time", () => {
    const failAt = new Date("2026-07-04T09:00:00Z");
    const rows = trackingHealthRows(
      base({
        github: {
          connected: true,
          lastSuccessAt: new Date("2026-07-01T00:00:00Z"),
          failure: { failures: 2, lastFailureAt: failAt, lastError: "boom" },
        },
      }),
    );
    const g = row(rows, "github");
    expect(g.tone).toBe("warn");
    expect(g.detail).toMatch(/2 failed deliveries/);
    expect(g.error).toBe("boom");
    expect(g.at).toEqual(failAt);
  });

  it("marks GitHub ok with the last-ship time when there are no failures", () => {
    const lastShip = new Date("2026-07-03T12:00:00Z");
    const rows = trackingHealthRows(
      base({ github: { connected: true, lastSuccessAt: lastShip, failure: noFailure } }),
    );
    expect(row(rows, "github").tone).toBe("ok");
    expect(row(rows, "github").at).toEqual(lastShip);
  });

  it("reflects Stripe configured-but-quiet vs. receiving", () => {
    const quiet = trackingHealthRows(
      base({ stripe: { configured: true, lastSuccessAt: null, failure: noFailure } }),
    );
    expect(row(quiet, "stripe").tone).toBe("idle");
    expect(row(quiet, "stripe").detail).toMatch(/no payments yet/);

    const paidAt = new Date("2026-07-04T08:00:00Z");
    const paid = trackingHealthRows(
      base({ stripe: { configured: true, lastSuccessAt: paidAt, failure: noFailure } }),
    );
    expect(row(paid, "stripe").tone).toBe("ok");
    expect(row(paid, "stripe").at).toEqual(paidAt);
  });
});
