import { describe, it, expect } from "vitest";
import { getProjectTagContext, type ClassifiableProject } from "./projectTags";
import { classificationInputHash, type ProductClassification } from "./classify";
import { matchChannels, SHORTFORM_TAG, type ChannelLike } from "./channels";

// A cached classification lives on the Project as JSON + a hash of its inputs.
// Helper: stamp a project so the hash matches (a cache HIT — no DB, no LLM).
function cachedProject(
  fields: { id?: string; userId?: string; name: string; description?: string | null; url?: string | null },
  classification: ProductClassification | null,
): ClassifiableProject {
  const base = {
    id: fields.id ?? "p1",
    userId: fields.userId ?? "u1",
    name: fields.name,
    description: fields.description ?? null,
    url: fields.url ?? null,
  };
  return {
    ...base,
    classificationJson: classification,
    classificationHash: classification
      ? classificationInputHash(base)
      : null,
  };
}

const CONSUMER_MOBILE: ProductClassification = {
  audience: "b2c",
  form: "mobile",
  visualDemo: true,
  confidence: "high",
  reason: "A consumer iPhone photo editor — a before/after Reel fits.",
};

describe("getProjectTagContext — classification merge (cache hit)", () => {
  it("merges cached consumer/visual tags into the context", async () => {
    const project = cachedProject(
      { name: "Snapthread", description: "stitch your clips", url: "https://snapthread.app" },
      CONSUMER_MOBILE,
    );
    const { ctx, classification } = await getProjectTagContext(project);
    expect(classification).toEqual(CONSUMER_MOBILE);
    expect(ctx.classificationTags).toEqual(
      expect.arrayContaining(["consumer", "b2c", "mobile-app", "visual-demo"]),
    );
  });

  it("adds NO consumer/visual tags for a low-confidence cached classification", async () => {
    const project = cachedProject(
      { name: "Ambiguous", description: "a mobile thing", url: null },
      { ...CONSUMER_MOBILE, confidence: "low" },
    );
    const { ctx } = await getProjectTagContext(project);
    expect(ctx.classificationTags).toEqual([]);
  });

  it("builds projectText / shipText / shipType from the inputs", async () => {
    const project = cachedProject(
      { name: "Snapthread", description: "clip editor", url: "https://snapthread.app" },
      CONSUMER_MOBILE,
    );
    const { ctx } = await getProjectTagContext(project, {
      ship: { title: "Auto-captions", summary: "one tap", type: "LAUNCH" },
      launchContext: true,
    });
    expect(ctx.projectText).toBe("Snapthread clip editor https://snapthread.app");
    expect(ctx.shipText).toBe("Auto-captions one tap");
    expect(ctx.shipType).toBe("LAUNCH");
    expect(ctx.launchContext).toBe(true);
  });
});

describe("getProjectTagContext — fallback (no classification)", () => {
  it("returns empty tags and null classification when classifyOnMiss is false", async () => {
    // No cached classification + cache-only → never calls the LLM.
    const project = cachedProject({ name: "Toolbox", description: "a devtool" }, null);
    const { ctx, classification } = await getProjectTagContext(project, {
      classifyOnMiss: false,
    });
    expect(classification).toBeNull();
    expect(ctx.classificationTags).toEqual([]);
  });

  it("falls back gracefully when the LLM is unconfigured on a cache miss", async () => {
    // Default classifyOnMiss=true, but no API key in the test env → classifyProduct
    // returns null and nothing is persisted; the heuristic path takes over.
    const project = cachedProject({ name: "Toolbox", description: "a devtool" }, null);
    const { ctx, classification } = await getProjectTagContext(project);
    expect(classification).toBeNull();
    expect(ctx.classificationTags).toEqual([]);
  });
});

// ── Consistency: the plan and the directory gate identically ──
describe("getProjectTagContext — consistent gating across surfaces", () => {
  const catalog: ChannelLike[] = [
    {
      id: "sf",
      slug: "tiktok-app-demo",
      name: "TikTok — App Demo",
      platform: "TIKTOK",
      defaultBanRisk: "LOW",
      tags: [SHORTFORM_TAG, "mobile-app", "consumer", "visual-demo"],
    },
    {
      id: "hn",
      slug: "hn-show",
      name: "Show HN",
      platform: "HACKERNEWS",
      defaultBanRisk: "LOW",
      tags: ["developers", "devtools", "launch"],
    },
  ];

  it("yields identical classification tags with a ship (plan) and without (directory)", async () => {
    const project = cachedProject(
      { name: "Snapthread", description: "clip editor" },
      CONSUMER_MOBILE,
    );
    // buildPlan-style call (ship + launch context)
    const planCtx = (
      await getProjectTagContext(project, {
        ship: { title: "v1", summary: "launch", type: "LAUNCH" },
        launchContext: true,
      })
    ).ctx;
    // directory-style call (no ship)
    const dirCtx = (await getProjectTagContext(project)).ctx;

    expect(planCtx.classificationTags).toEqual(dirCtx.classificationTags);

    // ...and both admit the short-form channel through matchChannels.
    const planSlugs = matchChannels(catalog, planCtx, 10).map((r) => r.channel.slug);
    const dirSlugs = matchChannels(catalog, dirCtx, 10).map((r) => r.channel.slug);
    expect(planSlugs).toContain("tiktok-app-demo");
    expect(dirSlugs).toContain("tiktok-app-demo");
  });

  it("excludes short-form for a devtool in BOTH the plan and directory contexts", async () => {
    const project = cachedProject(
      { name: "Migratedb", description: "a command-line devtool for developers" },
      { audience: "b2b", form: "cli", visualDemo: false, confidence: "high", reason: "CLI tool." },
    );
    const planCtx = (
      await getProjectTagContext(project, {
        ship: { title: "v2", summary: "release", type: "LAUNCH" },
        launchContext: true,
      })
    ).ctx;
    const dirCtx = (await getProjectTagContext(project)).ctx;

    expect(matchChannels(catalog, planCtx, 10).map((r) => r.channel.slug)).not.toContain(
      "tiktok-app-demo",
    );
    expect(matchChannels(catalog, dirCtx, 10).map((r) => r.channel.slug)).not.toContain(
      "tiktok-app-demo",
    );
  });
});
