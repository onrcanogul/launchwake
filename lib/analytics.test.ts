import { afterEach, describe, expect, it, vi } from "vitest";
import {
  EVENTS,
  CLIENT_EVENTS,
  isClientEvent,
  analyticsEnabled,
  buildCapturePayload,
  capture,
  captureUrl,
} from "./analytics";

const CFG = { apiKey: "phc_test", host: "https://ph.example.com" };

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("EVENTS", () => {
  it("covers the activation funnel with stable snake_case names", () => {
    expect(Object.values(EVENTS).sort()).toEqual(
      [
        "landing_view",
        "launch_checker_run",
        "signup",
        "first_plan_viewed",
        "draft_copied",
        "ship_marked_posted",
        "pixel_installed",
      ].sort(),
    );
  });

  it("only exposes browser-observable events to the client beacon", () => {
    expect(CLIENT_EVENTS).toEqual(["landing_view", "draft_copied"]);
    expect(isClientEvent("draft_copied")).toBe(true);
    expect(isClientEvent("signup")).toBe(false); // server-only: spoofable otherwise
    expect(isClientEvent("anything_else")).toBe(false);
  });
});

describe("buildCapturePayload", () => {
  const now = new Date("2026-07-05T12:00:00.000Z");

  it("builds an identified event for a user id", () => {
    const payload = buildCapturePayload(
      {
        event: EVENTS.shipMarkedPosted,
        distinctId: "user_123",
        properties: { platform: "REDDIT" },
      },
      CFG,
      { now },
    );
    expect(payload).toEqual({
      api_key: "phc_test",
      event: "ship_marked_posted",
      distinct_id: "user_123",
      properties: { platform: "REDDIT" },
      timestamp: "2026-07-05T12:00:00.000Z",
    });
  });

  it("marks events without a user as personless with an anon distinct id", () => {
    const payload = buildCapturePayload(
      { event: EVENTS.landingView },
      CFG,
      { anonId: "fixed", now },
    );
    expect(payload.distinct_id).toBe("anon:fixed");
    expect(payload.properties.$process_person_profile).toBe(false);
  });

  it("never flags identified events as personless", () => {
    const payload = buildCapturePayload(
      { event: EVENTS.signup, distinctId: "user_1" },
      CFG,
      { now },
    );
    expect(payload.properties.$process_person_profile).toBeUndefined();
  });

  it("generates a fresh anon id when none is injected", () => {
    const a = buildCapturePayload({ event: EVENTS.landingView }, CFG);
    const b = buildCapturePayload({ event: EVENTS.landingView }, CFG);
    expect(a.distinct_id).toMatch(/^anon:/);
    expect(a.distinct_id).not.toBe(b.distinct_id);
  });
});

describe("captureUrl", () => {
  it("appends /capture/ and tolerates a trailing slash", () => {
    expect(captureUrl("https://ph.example.com")).toBe("https://ph.example.com/capture/");
    expect(captureUrl("https://ph.example.com/")).toBe("https://ph.example.com/capture/");
  });
});

describe("capture", () => {
  it("is a no-op without a configured key", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    // vitest.setup.ts sets no POSTHOG_API_KEY, so the env-derived config is null.
    expect(analyticsEnabled()).toBe(false);
    await expect(capture({ event: EVENTS.signup, distinctId: "u1" })).resolves.toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("POSTs the payload to the capture endpoint when configured", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchSpy);

    const ok = await capture(
      { event: EVENTS.firstPlanViewed, distinctId: "user_9" },
      CFG,
    );

    expect(ok).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://ph.example.com/capture/");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body);
    expect(body.api_key).toBe("phc_test");
    expect(body.event).toBe("first_plan_viewed");
    expect(body.distinct_id).toBe("user_9");
  });

  it("swallows network failures and reports false", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("boom")));
    await expect(
      capture({ event: EVENTS.signup, distinctId: "u1" }, CFG),
    ).resolves.toBe(false);
  });

  it("reports false on a non-2xx response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    await expect(
      capture({ event: EVENTS.signup, distinctId: "u1" }, CFG),
    ).resolves.toBe(false);
  });
});
