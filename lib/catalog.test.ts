import { describe, it, expect, vi, beforeEach } from "vitest";

// getChannelDirectory reads the catalog + per-project signups from the Prisma
// singleton; mock it so we can unit-test the short-form gating end-to-end. The
// same mock covers projectTags.ts (cache read) — both import this "./db".
const dbMock = vi.hoisted(() => ({
  channel: { findMany: vi.fn() },
  event: { groupBy: vi.fn() },
  project: { update: vi.fn() },
}));
vi.mock("./db", () => ({ db: dbMock }));

import { getChannelDirectory } from "./catalog";
import { classificationInputHash, type ProductClassification } from "./classify";

// A catalog with a short-form channel plus ordinary ones.
const CATALOG = [
  {
    id: "sf",
    slug: "tiktok-app-demo",
    name: "TikTok — App Demo",
    platform: "TIKTOK",
    defaultBanRisk: "LOW",
    bestTime: "Evenings",
    tags: ["shortform", "mobile-app", "consumer", "visual-demo"],
    audienceDesc: null,
    rules: null,
    cost: null,
  },
  {
    id: "hn",
    slug: "hn-show",
    name: "Show HN",
    platform: "HACKERNEWS",
    defaultBanRisk: "LOW",
    bestTime: "Tue 8am",
    tags: ["developers", "devtools", "launch"],
    audienceDesc: null,
    rules: null,
    cost: null,
  },
  {
    id: "li",
    slug: "linkedin",
    name: "LinkedIn",
    platform: "LINKEDIN",
    defaultBanRisk: "LOW",
    bestTime: "Weekdays",
    tags: ["b2b", "saas", "founders"],
    audienceDesc: null,
    rules: null,
    cost: null,
  },
];

const CONSUMER_MOBILE: ProductClassification = {
  audience: "b2c",
  form: "mobile",
  visualDemo: true,
  confidence: "high",
  reason: "A consumer iPhone photo editor.",
};

/** Stamp a project so its cached classification is a HIT (no LLM in the test). */
function projectWith(
  fields: { name: string; description?: string | null; url?: string | null },
  classification: ProductClassification | null,
) {
  const base = {
    id: "p1",
    userId: "u1",
    name: fields.name,
    description: fields.description ?? null,
    url: fields.url ?? null,
  };
  return {
    ...base,
    classificationJson: classification,
    classificationHash: classification ? classificationInputHash(base) : null,
  };
}

beforeEach(() => {
  dbMock.channel.findMany.mockReset().mockResolvedValue(CATALOG);
  dbMock.event.groupBy.mockReset().mockResolvedValue([]);
  dbMock.project.update.mockReset().mockResolvedValue({});
});

describe("getChannelDirectory — short-form gating (consistent with buildPlan)", () => {
  it("includes short-form rows for a project with a cached consumer classification", async () => {
    const rows = await getChannelDirectory(
      projectWith(
        { name: "Snapthread", description: "stitch your clips", url: "https://snapthread.app" },
        CONSUMER_MOBILE,
      ),
    );
    const tiktok = rows.find((r) => r.slug === "tiktok-app-demo");
    expect(tiktok).toBeDefined();
    // ...and it carries a real fit score, not a placeholder.
    expect(tiktok!.fit).toBeGreaterThan(0);
    // The cache hit means no classify write happened.
    expect(dbMock.project.update).not.toHaveBeenCalled();
  });

  it("excludes short-form rows for a project with no classification and vague text", async () => {
    const rows = await getChannelDirectory(
      projectWith({ name: "Toolbox", description: "a small utility", url: null }, null),
    );
    expect(rows.some((r) => r.slug === "tiktok-app-demo")).toBe(false);
    // The ordinary channels still rank.
    expect(rows.some((r) => r.slug === "hn-show")).toBe(true);
  });

  it("excludes short-form for a low-confidence classification (conservative default)", async () => {
    const rows = await getChannelDirectory(
      projectWith(
        { name: "Ambiguous", description: "a mobile thing" },
        { ...CONSUMER_MOBILE, confidence: "low" },
      ),
    );
    expect(rows.some((r) => r.slug === "tiktok-app-demo")).toBe(false);
  });
});
