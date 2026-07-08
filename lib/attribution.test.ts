import { describe, it, expect, vi } from "vitest";
import {
  generateShortCode,
  slugifyCampaign,
  buildDestUrl,
  buildInsight,
  estimateEffortMinutes,
  formatEffort,
  formatMoney,
  sanitizeRef,
  captureSignupRef,
  type ResultRow,
} from "./attribution";

describe("generateShortCode", () => {
  it("is URL-safe and the requested length", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateShortCode(7);
      expect(code).toHaveLength(7);
      expect(code).toMatch(/^[0-9A-Za-z]+$/);
    }
  });
  it("is effectively unique across many draws", () => {
    const set = new Set(Array.from({ length: 500 }, () => generateShortCode()));
    expect(set.size).toBe(500);
  });
});

describe("slugifyCampaign", () => {
  it("kebab-cases and strips punctuation", () => {
    expect(slugifyCampaign("Added Slack alerts for failed webhooks!")).toBe(
      "added-slack-alerts-for-failed-webhooks",
    );
  });
});

describe("buildDestUrl", () => {
  it("appends channel-specific UTM params", () => {
    const url = buildDestUrl(
      "https://hookline.dev/",
      "HACKERNEWS",
      "v1.0 beta",
    );
    const u = new URL(url);
    expect(u.searchParams.get("utm_source")).toBe("hackernews");
    expect(u.searchParams.get("utm_medium")).toBe("launchwake");
    expect(u.searchParams.get("utm_campaign")).toBe("v1-0-beta");
  });
  it("preserves existing query params", () => {
    const url = buildDestUrl("https://hookline.dev/?plan=pro", "X", "ship");
    const u = new URL(url);
    expect(u.searchParams.get("plan")).toBe("pro");
    expect(u.searchParams.get("utm_source")).toBe("x");
  });
});

describe("ROI helpers", () => {
  it("estimates ~18 min of effort per posted channel", () => {
    expect(estimateEffortMinutes(0)).toBe(0);
    expect(estimateEffortMinutes(7)).toBe(126); // ~2h
  });
  it("formats effort as minutes or hours", () => {
    expect(formatEffort(45)).toBe("45m");
    expect(formatEffort(126)).toBe("2.1h");
    expect(formatEffort(600)).toBe("10h");
  });
  it("formats money from cents with the currency", () => {
    expect(formatMoney(34000, "usd")).toBe("$340");
    expect(formatMoney(4999, "usd")).toBe("$49.99");
    expect(formatMoney(29000, "eur")).toBe("€290");
  });
});

function row(partial: Partial<ResultRow> & { channelName: string }): ResultRow {
  return {
    postId: "p1",
    shipTitle: "beta",
    trackedUrl: null,
    postUrl: null,
    clicks: 0,
    signups: 0,
    conversion: 0,
    revenueCents: 0,
    recurringCents: 0,
    removed: false,
    coaching: null,
    ...partial,
  };
}

describe("buildInsight", () => {
  it("returns null with no data", () => {
    expect(buildInsight([])).toBeNull();
  });
  it("recommends doubling down on the best converter", () => {
    const insight = buildInsight([
      row({ channelName: "Hacker News", clicks: 100, signups: 5, conversion: 0.05 }),
      row({ channelName: "X", clicks: 100, signups: 2, conversion: 0.02 }),
    ])!;
    expect(insight).toMatch(/Hacker News/);
    expect(insight).toMatch(/double down/i);
  });
  it("flags a removed post when nothing converts", () => {
    const insight = buildInsight([
      row({ channelName: "r/SaaS", clicks: 10, removed: true }),
    ])!;
    expect(insight).toMatch(/r\/SaaS/);
    expect(insight).toMatch(/skip/i);
  });
  it("leads with revenue when a channel earned money", () => {
    const insight = buildInsight([
      row({ channelName: "Hacker News", clicks: 100, signups: 8, conversion: 0.08 }),
      row({ channelName: "Product Hunt", clicks: 40, signups: 3, revenueCents: 34000, recurringCents: 29000 }),
    ])!;
    // Revenue trumps raw signup conversion for the headline.
    expect(insight).toMatch(/Product Hunt/);
    expect(insight).toMatch(/\$340/);
    expect(insight).toMatch(/recurring/i);
  });
});

describe("sanitizeRef", () => {
  it("accepts a base62 short code", () => {
    expect(sanitizeRef("aB3xZ0q")).toBe("aB3xZ0q");
    expect(sanitizeRef("  aB3xZ0q  ")).toBe("aB3xZ0q"); // trims surrounding space
  });
  it("rejects empty, missing, or over-long values", () => {
    expect(sanitizeRef("")).toBeNull();
    expect(sanitizeRef("   ")).toBeNull();
    expect(sanitizeRef(null)).toBeNull();
    expect(sanitizeRef(undefined)).toBeNull();
    expect(sanitizeRef("a".repeat(65))).toBeNull();
  });
  it("rejects anything that isn't a plain short code (injection guard)", () => {
    expect(sanitizeRef("abc-123")).toBeNull();
    expect(sanitizeRef("abc/../x")).toBeNull();
    expect(sanitizeRef("<script>")).toBeNull();
    expect(sanitizeRef("a b")).toBeNull();
  });
});

describe("captureSignupRef", () => {
  const clientWith = (update = vi.fn().mockResolvedValue({})) =>
    ({ user: { update } }) as unknown as Parameters<typeof captureSignupRef>[2];

  it("stores a valid ref on the user", async () => {
    const update = vi.fn().mockResolvedValue({});
    const ok = await captureSignupRef("user_1", "aB3xZ0q", clientWith(update));
    expect(ok).toBe(true);
    expect(update).toHaveBeenCalledWith({
      where: { id: "user_1" },
      data: { lwRef: "aB3xZ0q" },
    });
  });

  it("no-ops (no write) when the ref is absent or malformed", async () => {
    const update = vi.fn().mockResolvedValue({});
    expect(await captureSignupRef("user_1", undefined, clientWith(update))).toBe(false);
    expect(await captureSignupRef("user_1", "bad/ref", clientWith(update))).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it("swallows a write failure so sign-in never breaks", async () => {
    const update = vi.fn().mockRejectedValue(new Error("db down"));
    await expect(captureSignupRef("user_1", "aB3xZ0q", clientWith(update))).resolves.toBe(false);
  });
});
