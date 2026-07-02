import { describe, it, expect, beforeEach } from "vitest";
import { rateLimit, clientIp, __resetRateLimit } from "./ratelimit";

describe("rateLimit", () => {
  beforeEach(() => __resetRateLimit());

  it("allows up to the limit within a window, then blocks", () => {
    const key = "ip:1";
    const t0 = 1_000;
    expect(rateLimit(key, 3, 1000, t0).ok).toBe(true);
    expect(rateLimit(key, 3, 1000, t0).ok).toBe(true);
    const third = rateLimit(key, 3, 1000, t0);
    expect(third.ok).toBe(true);
    expect(third.remaining).toBe(0);
    expect(rateLimit(key, 3, 1000, t0).ok).toBe(false);
  });

  it("resets after the window elapses", () => {
    const key = "ip:2";
    rateLimit(key, 1, 1000, 0);
    expect(rateLimit(key, 1, 1000, 500).ok).toBe(false);
    // Window (0..1000) has passed.
    expect(rateLimit(key, 1, 1000, 1000).ok).toBe(true);
  });

  it("keys are independent", () => {
    expect(rateLimit("a", 1, 1000, 0).ok).toBe(true);
    expect(rateLimit("b", 1, 1000, 0).ok).toBe(true);
    expect(rateLimit("a", 1, 1000, 0).ok).toBe(false);
  });
});

describe("clientIp", () => {
  it("takes the first x-forwarded-for entry", () => {
    const h = new Headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" });
    expect(clientIp(h)).toBe("203.0.113.9");
  });

  it("falls back to x-real-ip then 'unknown'", () => {
    expect(clientIp(new Headers({ "x-real-ip": "198.51.100.2" }))).toBe(
      "198.51.100.2",
    );
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
