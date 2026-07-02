import { describe, it, expect } from "vitest";
import {
  CHANGELOG,
  getChangelog,
  formatChangelogDate,
  changelogRss,
} from "./changelog";

const VALID_TAGS = new Set(["New", "Improved", "Fixed"]);

describe("changelog data", () => {
  it("every entry is well-formed", () => {
    for (const e of CHANGELOG) {
      expect(e.slug).toMatch(/^[a-z0-9-]+$/);
      expect(e.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(e.title.length).toBeGreaterThan(0);
      expect(e.items.length).toBeGreaterThan(0);
      expect(e.tags.length).toBeGreaterThan(0);
      for (const t of e.tags) expect(VALID_TAGS.has(t)).toBe(true);
    }
  });

  it("has unique slugs", () => {
    const slugs = CHANGELOG.map((e) => e.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("getChangelog returns entries newest-first", () => {
    const dates = getChangelog().map((e) => e.date);
    const sorted = [...dates].sort().reverse();
    expect(dates).toEqual(sorted);
  });
});

describe("formatChangelogDate", () => {
  it("formats an ISO date in UTC", () => {
    expect(formatChangelogDate("2026-07-02")).toBe("July 2, 2026");
  });
});

describe("changelogRss", () => {
  const xml = changelogRss("https://launchwake.com/");

  it("is a valid-looking RSS 2.0 feed with one item per entry", () => {
    expect(xml).toContain('<rss version="2.0">');
    expect(xml).toContain("<title>LaunchWake — Changelog</title>");
    const itemCount = (xml.match(/<item>/g) ?? []).length;
    expect(itemCount).toBe(CHANGELOG.length);
    expect(xml).toContain("https://launchwake.com/changelog#public-launch-reports");
  });

  it("escapes ampersands in titles", () => {
    // "agencies & DevRel" must be escaped, never a raw &.
    expect(xml).toContain("agencies &amp; DevRel");
    expect(xml).not.toMatch(/agencies & DevRel/);
  });
});
