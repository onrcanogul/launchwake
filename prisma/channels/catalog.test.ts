import { describe, it, expect } from "vitest";
import { assembleCatalog, channelCatalog, CATEGORIES } from "./index";
import { SeedSchema } from "./types";
import { AccountRequirementsSchema } from "../../lib/accountReadiness";
import { parseChannelCost } from "../../lib/channelCost";

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
    // The key launch venues must carry account-readiness guidance — including
    // the researched July-2026 batch (blogs, socials, directories, subreddits).
    const slugs = new Set(withReqs.map((c) => c.slug));
    for (const s of [
      "hn-show",
      "product-hunt",
      "r-saas",
      // core additions
      "dev-to",
      "hashnode",
      "lobsters",
      "x",
      "linkedin",
      "wip",
      "betalist",
      // subreddits
      "r-sideproject",
      "r-golang",
      "r-django",
      "r-vuejs",
      "r-rails",
      "r-gamedev",
      "r-machinelearning",
      "r-cybersecurity",
      // blogs & directories
      "medium",
      "hackernoon",
      "substack",
      "freecodecamp-news",
      "dzone",
      "dir-alternativeto",
      "dir-saashub",
    ]) {
      expect(slugs.has(s), `${s} should carry accountRequirements`).toBe(true);
    }
    // Every seeded requirement must satisfy the schema (grounded, not malformed)
    // and cite where it came from (the never-invent rule).
    for (const c of withReqs) {
      const parsed = AccountRequirementsSchema.safeParse(c.accountRequirements);
      expect(parsed.success, `${c.slug} accountRequirements invalid`).toBe(true);
      if (parsed.success) {
        expect(
          parsed.data.sourceNote.length,
          `${c.slug} missing a real sourceNote`,
        ).toBeGreaterThan(10);
      }
    }
    // Documented hard gates from the July 2026 research survive re-edits.
    const req = (slug: string) =>
      AccountRequirementsSchema.parse(
        channels.find((c) => c.slug === slug)?.accountRequirements,
      );
    expect(req("lobsters").minAccountAgeDays).toBe(70);
    expect(req("lobsters").level).toBe("required");
    expect(req("dir-alternativeto").minAccountAgeDays).toBe(7);
    expect(req("freecodecamp-news").minKarmaOrReputation?.value).toBe(3);
  });
});

describe("channel cost", () => {
  const { channels } = assembleCatalog();
  const bySlug = new Map(channels.map((c) => [c.slug, c]));
  const cost = (slug: string) => parseChannelCost(bySlug.get(slug)?.cost);

  it("every channel resolves to a valid cost (absent → free)", () => {
    for (const c of channels) {
      expect(["free", "paid", "freemium"]).toContain(parseChannelCost(c.cost).type);
    }
  });

  it("every paid/freemium channel carries a factual price note", () => {
    for (const c of channels) {
      const parsed = parseChannelCost(c.cost);
      if (parsed.type !== "free") {
        expect(parsed.note, `${c.slug} (${parsed.type}) needs a price note`).toBeTruthy();
        expect((parsed.note ?? "").length).toBeGreaterThan(2);
      }
    }
  });

  it("BetaList is paid-only, from $39 (the dogfood finding)", () => {
    expect(cost("betalist").type).toBe("paid");
    expect(cost("betalist").note).toMatch(/\$39/);
  });

  it("directory venues with a free queue + paid tiers are freemium", () => {
    for (const slug of [
      "dir-uneed",
      "dir-microlaunch",
      "dir-fazier",
      "dir-launching-next",
    ]) {
      expect(cost(slug).type, slug).toBe("freemium");
    }
  });

  it("WIP is not free — invite-only + paid membership (dogfood finding)", () => {
    expect(cost("wip").type).toBe("freemium");
    expect(cost("wip").note).toMatch(/invite|paid/i);
  });

  it("free venues (Peerlist, subreddits) default to free", () => {
    expect(cost("dir-peerlist").type).toBe("free");
    expect(cost("r-saas").type).toBe("free");
  });

  it("rejects an unknown cost type at the schema boundary", () => {
    const parsed = SeedSchema.safeParse({
      slug: "x-bad",
      name: "Bad",
      platform: "OTHER",
      url: "https://example.com",
      audienceDesc: "x",
      rules: "some real rules here",
      defaultBanRisk: "LOW",
      bestTime: "Anytime",
      tags: ["x"],
      cost: { type: "sponsored" },
    });
    expect(parsed.success).toBe(false);
  });
});
