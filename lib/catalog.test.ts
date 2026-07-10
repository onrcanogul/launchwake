import { describe, it, expect, vi, beforeEach } from "vitest";

// getChannelDirectory reads the catalog + per-project signups from the Prisma
// singleton; mock it so we can unit-test the ranking end-to-end.
const dbMock = vi.hoisted(() => ({
  channel: { findMany: vi.fn() },
  event: { groupBy: vi.fn() },
}));
vi.mock("./db", () => ({ db: dbMock }));

import { getChannelDirectory } from "./catalog";
import type { ClassifiableProject } from "./projectTags";

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

const project = (fields: {
  name: string;
  description?: string | null;
  url?: string | null;
}): ClassifiableProject => ({
  id: "p1",
  name: fields.name,
  description: fields.description ?? null,
  url: fields.url ?? null,
});

beforeEach(() => {
  dbMock.channel.findMany.mockReset().mockResolvedValue(CATALOG);
  dbMock.event.groupBy.mockReset().mockResolvedValue([]);
});

describe("getChannelDirectory — short-form is ranked by fit, not gated", () => {
  it("ranks short-form at the top for a visual consumer product", async () => {
    const rows = await getChannelDirectory(
      project({
        name: "Snapthread",
        description: "a consumer mobile app to edit your photos",
        url: "https://snapthread.app",
      }),
    );
    expect(rows[0].slug).toBe("tiktok-app-demo");
    expect(rows[0].fit).toBeGreaterThan(0);
  });

  it("keeps short-form in the directory but ranks it below matching channels for a devtool", async () => {
    const rows = await getChannelDirectory(
      project({
        name: "Migratedb",
        description: "a command-line devtool for developers to run migrations",
      }),
    );
    const tiktokIdx = rows.findIndex((r) => r.slug === "tiktok-app-demo");
    const hnIdx = rows.findIndex((r) => r.slug === "hn-show");
    // Present (the directory lists the full catalog) but out-ranked by the real
    // dev channel — no hard gate, just a lower fit score.
    expect(tiktokIdx).toBeGreaterThan(-1);
    expect(hnIdx).toBeLessThan(tiktokIdx);
    expect(rows[tiktokIdx].fit).toBeLessThanOrEqual(rows[hnIdx].fit);
  });
});
