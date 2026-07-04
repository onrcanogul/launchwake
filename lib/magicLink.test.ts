import { describe, it, expect, beforeEach } from "vitest";
import { rateLimit, __resetRateLimit } from "./ratelimit";
import { evaluateMagicLinkLimit, MAGIC_LINK_LIMITS } from "./magicLink";

// Drive the pure evaluator with the in-memory, clock-injectable `rateLimit` so
// we can assert the window math without a database.
describe("evaluateMagicLinkLimit", () => {
  beforeEach(() => __resetRateLimit());

  it("allows 3 sends per email within 15 minutes, then blocks the 4th", async () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 3; i++) {
      expect(await evaluateMagicLinkLimit("a@b.com", "1.1.1.1", rateLimit, t0)).toBe(
        true,
      );
    }
    expect(await evaluateMagicLinkLimit("a@b.com", "1.1.1.1", rateLimit, t0)).toBe(
      false,
    );
  });

  it("resets the email window after 15 minutes", async () => {
    const t0 = 0;
    for (let i = 0; i < 3; i++) {
      await evaluateMagicLinkLimit("a@b.com", "1.1.1.1", rateLimit, t0);
    }
    // Still inside the 15-min window → blocked.
    expect(await evaluateMagicLinkLimit("a@b.com", "1.1.1.1", rateLimit, t0 + 5_000)).toBe(
      false,
    );
    // Window has elapsed → allowed again.
    const later = MAGIC_LINK_LIMITS.email.windowMs;
    expect(await evaluateMagicLinkLimit("a@b.com", "1.1.1.1", rateLimit, later)).toBe(
      true,
    );
  });

  it("blocks after 10 sends from one IP within an hour, across different emails", async () => {
    const t0 = 0;
    for (let i = 0; i < 10; i++) {
      expect(
        await evaluateMagicLinkLimit(`u${i}@b.com`, "9.9.9.9", rateLimit, t0),
      ).toBe(true);
    }
    // 11th distinct email, same IP → the IP bucket is the gate now.
    expect(await evaluateMagicLinkLimit("u10@b.com", "9.9.9.9", rateLimit, t0)).toBe(
      false,
    );
  });

  it("requires BOTH buckets: a fresh email is still blocked once the IP is exhausted", async () => {
    const t0 = 0;
    for (let i = 0; i < 10; i++) {
      await evaluateMagicLinkLimit(`u${i}@b.com`, "5.5.5.5", rateLimit, t0);
    }
    expect(
      await evaluateMagicLinkLimit("brand-new@b.com", "5.5.5.5", rateLimit, t0),
    ).toBe(false);
  });
});
