import { describe, it, expect } from "vitest";
import {
  explainBanRisk,
  postingChecklist,
  seoQuestion,
  channelFaq,
  relatedChannels,
  comparisonSlug,
  parseComparisonSlug,
  comparisonVerdict,
  COMPARISON_PAIRS,
  TAG_HUBS,
  isTagHub,
  type PublicChannelLike,
} from "./publicCatalog";
import { channelCatalog } from "../prisma/channels/index";

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

describe("channelFaq", () => {
  it("always answers the core question, removal triggers, and account question", () => {
    const faq = channelFaq(rSaas);
    const questions = faq.map((f) => f.question);
    expect(questions).toContain("Can I post my startup on r/SaaS?");
    expect(questions.some((q) => /removed/.test(q))).toBe(true);
    expect(questions.some((q) => /established account/.test(q))).toBe(true);
    for (const f of faq) expect(f.answer.length).toBeGreaterThan(20);
  });

  it("includes a best-time entry only when the catalog has one", () => {
    const withTime = channelFaq(rSaas).map((f) => f.question);
    expect(withTime.some((q) => /best time/.test(q))).toBe(true);
    const noTime = channelFaq({ ...rSaas, bestTime: null }).map((f) => f.question);
    expect(noTime.some((q) => /best time/.test(q))).toBe(false);
  });

  it("grounds the account answer in seeded requirements when present", () => {
    const faq = channelFaq(rSaas, {
      level: "recommended",
      minAccountAgeDays: 30,
      minKarmaOrReputation: { value: 100, unit: "karma" },
      profileTips: ["Comment for a week first."],
      sourceNote: "r/SaaS wiki",
    });
    const account = faq.find((f) => /established account/.test(f.question));
    expect(account?.answer).toContain("30 days");
    expect(account?.answer).toContain("100+ karma");
    expect(account?.answer).toContain("r/SaaS wiki");
  });
});

describe("relatedChannels", () => {
  const pool: PublicChannelLike[] = [
    rSaas,
    hnShow,
    { ...rSaas, slug: "r-startups", name: "r/startups", tags: ["saas", "startup"] },
    { ...hnShow, slug: "lobsters", name: "Lobsters", platform: "LOBSTERS", tags: ["developers"] },
    { ...rSaas, slug: "r-gamedev", name: "r/gamedev", tags: ["gamedev"], platform: "REDDIT" },
  ];

  it("ranks shared-tag channels first and never returns self", () => {
    const related = relatedChannels(rSaas, pool);
    expect(related[0].slug).toBe("r-startups");
    expect(related.map((c) => c.slug)).not.toContain("r-saas");
  });

  it("excludes channels with nothing in common", () => {
    const related = relatedChannels(hnShow, pool);
    expect(related.map((c) => c.slug)).not.toContain("r-gamedev");
  });
});

describe("tag hubs and comparisons stay grounded in the seeded catalog", () => {
  const catalog = channelCatalog();
  const slugs = new Set(catalog.map((c) => c.slug));

  it("every comparison pair references two real, distinct channels", () => {
    for (const pair of COMPARISON_PAIRS) {
      expect(slugs.has(pair.a), `missing slug: ${pair.a}`).toBe(true);
      expect(slugs.has(pair.b), `missing slug: ${pair.b}`).toBe(true);
      expect(pair.a).not.toBe(pair.b);
    }
  });

  it("every hub tag exists in the catalog with 3+ channels", () => {
    for (const hub of TAG_HUBS) {
      const count = catalog.filter((c) => c.tags.includes(hub)).length;
      expect(count, `hub "${hub}" has only ${count} channels`).toBeGreaterThanOrEqual(3);
    }
  });

  it("comparison slugs round-trip", () => {
    for (const pair of COMPARISON_PAIRS) {
      expect(parseComparisonSlug(comparisonSlug(pair))).toEqual(pair);
    }
    expect(parseComparisonSlug("not-a-real-vs-pair")).toBeNull();
  });

  it("isTagHub accepts hubs and rejects arbitrary tags", () => {
    expect(isTagHub("devtools")).toBe(true);
    expect(isTagHub("gamedev")).toBe(false);
  });
});

describe("comparisonVerdict", () => {
  it("names the safer channel when risks differ", () => {
    const v = comparisonVerdict(hnShow, rSaas);
    expect(v).toContain("Hacker News — Show HN");
    expect(v).toContain("safer");
  });

  it("falls back to audience when risks match", () => {
    const v = comparisonVerdict(rSaas, { ...rSaas, slug: "x2", name: "Other" });
    expect(v).toContain("choose by audience");
  });
});
