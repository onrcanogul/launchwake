import { describe, it, expect } from "vitest";
import { getProjectTagContext, type ClassifiableProject } from "./projectTags";
import { matchChannels, SHORTFORM_TAG, type ChannelLike } from "./channels";

const project: ClassifiableProject = {
  id: "p1",
  name: "Snapthread",
  description: "a consumer mobile app to edit your photos",
  url: "https://snapthread.app",
};

describe("getProjectTagContext — pure match-context builder", () => {
  it("builds projectText / shipText / shipType / launchContext from the inputs", async () => {
    const { ctx } = await getProjectTagContext(project, {
      ship: { title: "Auto-captions", summary: "one tap", type: "LAUNCH" },
      launchContext: true,
    });
    expect(ctx.projectText).toBe(
      "Snapthread a consumer mobile app to edit your photos https://snapthread.app",
    );
    expect(ctx.shipText).toBe("Auto-captions one tap");
    expect(ctx.shipType).toBe("LAUNCH");
    expect(ctx.launchContext).toBe(true);
  });

  it("defaults shipType to OTHER and shipText to empty with no ship", async () => {
    const { ctx } = await getProjectTagContext(project);
    expect(ctx.shipText).toBe("");
    expect(ctx.shipType).toBe("OTHER");
  });

  it("folds extraProjectText into projectText", async () => {
    const { ctx } = await getProjectTagContext(project, {
      extraProjectText: "video editing ios",
    });
    expect(ctx.projectText).toContain("video editing ios");
  });
});

// ── The plan and the directory derive the SAME context (no gate) ──
describe("getProjectTagContext — consistent signals across surfaces", () => {
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

  it("surfaces short-form for a consumer app in both plan and directory contexts", async () => {
    // plan-style (with ship) and directory-style (no ship) both derive the
    // consumer/mobile-app signals from the product text → short-form is a match.
    const planCtx = (
      await getProjectTagContext(project, {
        ship: { title: "v1", summary: "launch", type: "OTHER" },
      })
    ).ctx;
    const dirCtx = (await getProjectTagContext(project)).ctx;

    const planSlugs = matchChannels(catalog, planCtx, 10).map((r) => r.channel.slug);
    const dirSlugs = matchChannels(catalog, dirCtx, 10).map((r) => r.channel.slug);
    expect(planSlugs).toContain("tiktok-app-demo");
    expect(dirSlugs).toContain("tiktok-app-demo");
    // and for this consumer product it out-ranks the dev channel.
    expect(planSlugs[0]).toBe("tiktok-app-demo");
  });

  it("ranks short-form last for a devtool in both contexts (no keyword match)", async () => {
    const devtool: ClassifiableProject = {
      id: "p2",
      name: "Migratedb",
      description: "a command-line devtool for developers",
      url: null,
    };
    const planCtx = (
      await getProjectTagContext(devtool, {
        ship: { title: "v2", summary: "release", type: "LAUNCH" },
      })
    ).ctx;
    const dirCtx = (await getProjectTagContext(devtool)).ctx;

    for (const ctx of [planCtx, dirCtx]) {
      const slugs = matchChannels(catalog, ctx, 10).map((r) => r.channel.slug);
      expect(slugs.indexOf("hn-show")).toBeLessThan(slugs.indexOf("tiktok-app-demo"));
    }
  });
});
