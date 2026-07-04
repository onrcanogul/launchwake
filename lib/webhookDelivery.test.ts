import { describe, it, expect } from "vitest";
import {
  MAX_WEBHOOK_ATTEMPTS,
  hashPayload,
  computeBackoffMs,
  computeNextRetryAt,
  isRetryDue,
} from "./webhookDelivery";

describe("hashPayload", () => {
  it("is deterministic and 64-hex for the same body", () => {
    const a = hashPayload('{"a":1}');
    const b = hashPayload('{"a":1}');
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("differs for different bodies", () => {
    expect(hashPayload('{"a":1}')).not.toBe(hashPayload('{"a":2}'));
  });
});

describe("computeBackoffMs", () => {
  it("doubles each attempt starting at 1 minute", () => {
    expect(computeBackoffMs(1)).toBe(60_000);
    expect(computeBackoffMs(2)).toBe(120_000);
    expect(computeBackoffMs(3)).toBe(240_000);
    expect(computeBackoffMs(4)).toBe(480_000);
    expect(computeBackoffMs(5)).toBe(960_000);
  });

  it("caps at one hour so a parked row never schedules hours out", () => {
    expect(computeBackoffMs(10)).toBe(60 * 60_000);
    expect(computeBackoffMs(100)).toBe(60 * 60_000);
  });

  it("floors sub-1 attempts to the base", () => {
    expect(computeBackoffMs(0)).toBe(60_000);
  });
});

describe("computeNextRetryAt", () => {
  it("adds the backoff to the base time", () => {
    const from = new Date("2026-07-04T00:00:00.000Z");
    expect(computeNextRetryAt(1, from).toISOString()).toBe("2026-07-04T00:01:00.000Z");
    expect(computeNextRetryAt(3, from).toISOString()).toBe("2026-07-04T00:04:00.000Z");
  });
});

describe("isRetryDue", () => {
  const now = new Date("2026-07-04T01:00:00.000Z");
  const due = new Date("2026-07-04T00:59:00.000Z");
  const future = new Date("2026-07-04T01:01:00.000Z");

  it("is due for a FAILED row past its backoff with attempts left", () => {
    expect(isRetryDue({ status: "FAILED", attempts: 2, nextRetryAt: due }, now)).toBe(true);
  });

  it("is not due before the backoff elapses", () => {
    expect(isRetryDue({ status: "FAILED", attempts: 2, nextRetryAt: future }, now)).toBe(false);
  });

  it("is not due once attempts are exhausted", () => {
    expect(
      isRetryDue({ status: "FAILED", attempts: MAX_WEBHOOK_ATTEMPTS, nextRetryAt: due }, now),
    ).toBe(false);
  });

  it("is not due for PROCESSED rows or rows without a scheduled retry", () => {
    expect(isRetryDue({ status: "PROCESSED", attempts: 1, nextRetryAt: due }, now)).toBe(false);
    expect(isRetryDue({ status: "FAILED", attempts: 1, nextRetryAt: null }, now)).toBe(false);
  });
});
