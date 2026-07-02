import { describe, it, expect } from "vitest";
import {
  explainBanRisk,
  postingChecklist,
  seoQuestion,
  type PublicChannelLike,
} from "./publicCatalog";

const rSaas: PublicChannelLike = {
  slug: "r-saas",
  name: "r/SaaS",
  platform: "REDDIT",
  rules:
    "Heavily moderated for self-promo. Share lessons/metrics, not pitches. Direct product links often removed.",
  defaultBanRisk: "HIGH",
  bestTime: "Tue–Thu 10am ET",
  tags: ["saas", "founders"],
};

const hnShow: PublicChannelLike = {
  slug: "hn-show",
  name: "Hacker News — Show HN",
  platform: "HACKERNEWS",
  rules: "Lead with the problem and the build story. No hype adjectives.",
  defaultBanRisk: "LOW",
  bestTime: "Tue 8am ET",
  tags: ["developers"],
};

describe("explainBanRisk", () => {
  it("mirrors the catalog risk level", () => {
    expect(explainBanRisk(rSaas).level).toBe("HIGH");
    expect(explainBanRisk(hnShow).level).toBe("LOW");
  });

  it("derives concrete factors from the rule text", () => {
    const factors = explainBanRisk(rSaas).factors.join(" ").toLowerCase();
    expect(factors).toContain("moderated");
    expect(factors).toContain("promotion");
  });

  it("always returns at least one factor even with sparse rules", () => {
    const sparse: PublicChannelLike = { ...hnShow, rules: null };
    expect(explainBanRisk(sparse).factors.length).toBeGreaterThan(0);
  });
});

describe("postingChecklist", () => {
  it("gives platform-specific dos and donts", () => {
    const hn = postingChecklist(hnShow);
    expect(hn.dos.some((d) => /show hn/i.test(d))).toBe(true);
    expect(hn.donts.length).toBeGreaterThan(0);

    const li = postingChecklist({ ...rSaas, platform: "LINKEDIN" });
    expect(li.dos.some((d) => /first comment/i.test(d))).toBe(true);
  });

  it("falls back to OTHER for unknown platforms", () => {
    const c = postingChecklist({ ...hnShow, platform: "MASTODON" });
    expect(c.dos.length).toBeGreaterThan(0);
    expect(c.donts.length).toBeGreaterThan(0);
  });
});

describe("seoQuestion", () => {
  it("phrases the target search query", () => {
    expect(seoQuestion(rSaas)).toBe("Can I post my startup on r/SaaS?");
  });
});
