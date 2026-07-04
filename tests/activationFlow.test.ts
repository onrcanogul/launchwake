import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../lib/db";
import { buildPlan } from "../lib/analysis";
import {
  recordPostForRecommendation,
  ingestClick,
  getResultsRollup,
} from "../lib/attribution";
import { channelCatalog } from "../prisma/channels";

/**
 * End-to-end integration test of the activation happy path, exercising the REAL
 * production functions against a REAL Postgres (no fakes):
 *
 *   project → ship → buildPlan (heuristic, no LLM key) → recordPostForRecommendation
 *   (mints a TrackedLink) → ingestClick (records a CLICK) → getResultsRollup
 *   (the click surfaces per-post, per-channel, and in the totals).
 *
 * The repo has no dedicated test Postgres, so the suite SKIPS (never fails) when
 * it can't reach a database. To run it locally against your dev DB:
 *
 *   DATABASE_URL='postgresql://<user>@localhost:5432/launchwake?schema=public' \
 *     pnpm test tests/activationFlow.test.ts
 *
 * All rows are created under a unique throwaway user and torn down in afterAll —
 * deleting the User cascades to Project → Ship → Plan → Post → TrackedLink →
 * Event — so it's safe to point at a shared dev database.
 */

let dbAvailable = false;
let userId: string | null = null;
let projectId = "";
let shipId = "";

const TEST_EMAIL = `activation-test+${Date.now()}@launchwake.test`;

async function canConnect(): Promise<boolean> {
  try {
    await db.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

beforeAll(async () => {
  dbAvailable = await canConnect();
  if (!dbAvailable) return;

  // buildPlan ranks only channels that exist in the catalog — seed it if this DB
  // has never been seeded, so the test is self-sufficient on a fresh database.
  if ((await db.channel.count()) === 0) {
    for (const c of channelCatalog()) {
      await db.channel.upsert({ where: { slug: c.slug }, update: {}, create: c });
    }
  }

  // A brand-new user with one product (Growth Mode). The product URL is required
  // to mint a tracked link (that's where clicks are sent).
  const user = await db.user.create({
    data: { email: TEST_EMAIL, name: "Activation Test", plan: "FREE" },
  });
  userId = user.id;

  const project = await db.project.create({
    data: {
      userId: user.id,
      name: "Hookline",
      description:
        "Webhook testing and debugging tool for backend and full-stack developers.",
      url: "https://hookline.dev",
    },
  });
  projectId = project.id;

  const ship = await db.ship.create({
    data: {
      projectId: project.id,
      type: "LAUNCH",
      title: "Hookline 1.0 — replay any webhook to localhost",
      summary: "Capture, inspect and replay inbound webhooks in one place.",
    },
  });
  shipId = ship.id;
});

afterAll(async () => {
  if (userId) {
    await db.user.delete({ where: { id: userId } }).catch(() => {});
  }
  await db.$disconnect().catch(() => {});
});

describe("activation happy path (project → plan → tracked link → click → results)", () => {
  it("generates a plan, mints a link on post, records a click, and rolls it up", async (ctx) => {
    if (!dbAvailable) {
      ctx.skip();
      return;
    }

    // ── 1. Plan generated ────────────────────────────────────────────────────
    // No LLM key in the test env → deterministic heuristic ranking, grounded in
    // the seeded catalog. Ship advances NEW → PLANNED.
    const planId = await buildPlan(shipId);
    expect(planId).toBeTruthy();

    const recs = await db.recommendation.findMany({
      where: { plan: { shipId } },
      orderBy: [{ rank: "asc" }, { fitScore: "desc" }],
      include: { channel: true },
    });
    expect(recs.length).toBeGreaterThan(0);
    for (const r of recs) {
      expect(r.fitScore).toBeGreaterThanOrEqual(0);
      expect(r.fitScore).toBeLessThanOrEqual(100);
      expect(r.whyText.length).toBeGreaterThan(0);
      // Grounded: every recommended channel is a real catalog channel.
      expect(r.channel.slug).toBeTruthy();
    }
    expect(
      (await db.ship.findUniqueOrThrow({ where: { id: shipId } })).status,
    ).toBe("PLANNED");

    const top = recs[0];

    // ── 2. Tracked link minted ───────────────────────────────────────────────
    // The founder marks the top channel as posted → Post + TrackedLink created.
    const posted = await recordPostForRecommendation(top.id);
    expect(posted.shortCode).toMatch(/^[0-9A-Za-z]{7}$/);
    expect(posted.trackedUrl).toContain(`/r/${posted.shortCode}`);

    const dest = new URL(posted.destUrl);
    expect(dest.origin + dest.pathname).toBe("https://hookline.dev/");
    expect(dest.searchParams.get("utm_medium")).toBe("launchwake");

    // Idempotent: re-marking the same channel returns the same link.
    const again = await recordPostForRecommendation(top.id);
    expect(again.shortCode).toBe(posted.shortCode);

    // Marking a post advances the ship to POSTED.
    expect(
      (await db.ship.findUniqueOrThrow({ where: { id: shipId } })).status,
    ).toBe("POSTED");

    // ── 3. Click recorded ────────────────────────────────────────────────────
    // A real hit on /r/{code}: logs a CLICK and returns the destination + lw_ref.
    const clickDest = await ingestClick(posted.shortCode, { record: true });
    expect(clickDest).not.toBeNull();
    expect(new URL(clickDest!).searchParams.get("lw_ref")).toBe(posted.shortCode);

    // An unknown code returns null (the /r route redirects home — never a 500)
    // and must not create a stray CLICK event.
    expect(await ingestClick("0000000")).toBeNull();

    // ── 4. Rollup includes the click ─────────────────────────────────────────
    const rollup = await getResultsRollup(projectId);
    expect(rollup.totalClicks).toBe(1);
    expect(rollup.perPost).toHaveLength(1);
    expect(rollup.perPost[0].clicks).toBe(1);
    expect(rollup.perPost[0].channelName).toBe(top.channel.name);

    const chan = rollup.perChannel.find((c) => c.channelName === top.channel.name);
    expect(chan?.clicks).toBe(1);
    expect(chan?.posts).toBe(1);
  });
});
