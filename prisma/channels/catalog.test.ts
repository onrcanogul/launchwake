import { describe, it, expect } from "vitest";
import { assembleCatalog, channelCatalog, CATEGORIES } from "./index";
import { AccountRequirementsSchema } from "../../lib/accountReadiness";

describe("channel catalog", () => {
  const { channels, issues, byCategory } = assembleCatalog();

  it("assembles with zero validation or duplicate issues", () => {
    expect(issues).toEqual([]);
  });

  it("holds 100+ channels (the paid-tier breadth)", () => {
    expect(channels.length).toBeGreaterThanOrEqual(100);
  });

  it("has globally unique slugs", () => {
    const slugs = channels.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("every channel has a real url, rules, best time, and at least one tag", () => {
    for (const c of channels) {
      expect(c.url).toMatch(/^https?:\/\//);
      expect(c.rules.length).toBeGreaterThan(10);
      expect(c.bestTime.length).toBeGreaterThan(0);
      expect(c.tags.length).toBeGreaterThan(0);
    }
  });

  it("spans the new platform categories (not just the demo 20)", () => {
    const platforms = new Set(channels.map((c) => c.platform));
    for (const p of ["DISCORD", "SLACK", "NEWSLETTER", "DIRECTORY", "BLOG", "FORUM"]) {
      expect(platforms.has(p as never)).toBe(true);
    }
  });

  it("channelCatalog() returns the same set without throwing", () => {
    expect(channelCatalog().length).toBe(channels.length);
  });

  it("reports a per-category breakdown", () => {
    // Every registered category contributes entries.
    for (const cat of Object.keys(CATEGORIES)) {
      expect(byCategory[cat]).toBeGreaterThan(0);
    }
  });

  it("seeds valid account requirements on the launch channels", () => {
    const withReqs = channels.filter((c) => c.accountRequirements);
    // The key launch venues must carry account-readiness guidance.
    const slugs = new Set(withReqs.map((c) => c.slug));
    for (const s of ["hn-show", "product-hunt", "r-saas"]) {
      expect(slugs.has(s)).toBe(true);
    }
    // Every seeded requirement must satisfy the schema (grounded, not malformed).
    for (const c of withReqs) {
      const parsed = AccountRequirementsSchema.safeParse(c.accountRequirements);
      expect(parsed.success, `${c.slug} accountRequirements invalid`).toBe(true);
    }
  });
});
