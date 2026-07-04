import { describe, it, expect, vi } from "vitest";
import { retryDelayMs, withRetry, MAX_WEBHOOK_ATTEMPTS } from "./webhookDelivery";

describe("retryDelayMs", () => {
  it("follows an exponential, capped backoff (minutes)", () => {
    expect(retryDelayMs(1)).toBe(1 * 60_000);
    expect(retryDelayMs(2)).toBe(5 * 60_000);
    expect(retryDelayMs(3)).toBe(15 * 60_000);
    expect(retryDelayMs(4)).toBe(30 * 60_000);
    expect(retryDelayMs(5)).toBe(60 * 60_000);
  });

  it("clamps out-of-range attempts to the ends of the schedule", () => {
    expect(retryDelayMs(0)).toBe(1 * 60_000);
    expect(retryDelayMs(-3)).toBe(1 * 60_000);
    expect(retryDelayMs(99)).toBe(60 * 60_000);
  });

  it("dead-letters after MAX_WEBHOOK_ATTEMPTS", () => {
    expect(MAX_WEBHOOK_ATTEMPTS).toBe(5);
  });
});

describe("withRetry", () => {
  const noSleep = () => Promise.resolve();

  it("returns immediately on first success (no retries)", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const out = await withRetry(fn, { sleep: noSleep });
    expect(out).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries transient failures and then succeeds", async () => {
    let n = 0;
    const fn = vi.fn(async () => {
      n += 1;
      if (n < 3) throw new Error("blip");
      return "recovered";
    });
    const onError = vi.fn();
    const out = await withRetry(fn, { attempts: 3, sleep: noSleep, onError });
    expect(out).toBe("recovered");
    expect(fn).toHaveBeenCalledTimes(3);
    expect(onError).toHaveBeenCalledTimes(2);
  });

  it("throws the last error after exhausting attempts", async () => {
    const fn = vi.fn(async () => {
      throw new Error("still broken");
    });
    await expect(
      withRetry(fn, { attempts: 3, sleep: noSleep }),
    ).rejects.toThrow("still broken");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("backs off with doubling delays between attempts", async () => {
    const delays: number[] = [];
    const sleep = (ms: number) => {
      delays.push(ms);
      return Promise.resolve();
    };
    const fn = vi.fn(async () => {
      throw new Error("nope");
    });
    await expect(
      withRetry(fn, { attempts: 4, baseDelayMs: 100, sleep }),
    ).rejects.toThrow();
    // one sleep between each of the 4 tries → 3 sleeps, doubling from base.
    expect(delays).toEqual([100, 200, 400]);
  });
});
