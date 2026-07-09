import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../lib/db";
import { buildPlan } from "../lib/analysis";
import {
  recordPostForRecommendation,
  ingestClick,
  recordSignup,
  recordSelfReport,
  getReconciledResults,
} from "../lib/attribution";
import { sourcePlatform } from "../lib/selfReport";
import { channelCatalog } from "../prisma/channels";

/**
 * Integration test of the honest blended Results view against a REAL Postgres:
 *
 *   plan → post (channel A) → click → signup with lw_ref  →  TRACKED signup for A
 *   survey answer naming a DIFFERENT channel B            →  REPORTED signup for B
 *   getReconciledResults → A shows tracked (not reported), B shows reported (not
 *   tracked), and the totals reconcile within each system.
 *
 * The repo has no dedicated test Postgres, so this SKIPS (never fails) when it
 * can't reach a database — same pattern as tests/activationFlow.test.ts. Run it
 * locally against a dev DB with DATABASE_URL set. Teardown cascades from the user.
 */

let dbAvailable = false;
let userId: string | null = null;
let projectId = "";
let shipId = "";

const TEST_EMAIL = `reconcile-test+${Date.now()}@launchwake.test`;

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

  if ((await db.channel.count()) === 0) {
    for (const c of channelCatalog()) {
      await db.channel.upsert({ where: { slug: c.slug }, update: {}, create: c });
    }
  }

  const user = await db.user.create({
    data: { email: TEST_EMAIL, name: "Reconcile Test", plan: "FREE" },
  });
  userId = user.id;

  const project = await db.project.create({
    data: {
      userId: user.id,
      name: "Hookline",
      description: "Webhook testing and debugging tool for backend developers.",
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
  if (userId) await db.user.delete({ where: { id: userId } }).catch(() => {});
  await db.$disconnect().catch(() => {});
});

describe("reconciled Results (tracked vs reported, different channels)", () => {
  it("shows a tracked signup and a separate reported signup, and totals reconcile", async (ctx) => {
    if (!dbAvailable) {
      ctx.skip();
      return;
    }

    // ── Plan + post channel A, then click + tracked signup on its lw_ref ──────
    await buildPlan(shipId);
    const top = await db.recommendation.findFirstOrThrow({
      where: { plan: { shipId } },
      orderBy: [{ rank: "asc" }, { fitScore: "desc" }],
      include: { channel: true },
    });
    const trackedPlatform = String(top.channel.platform);

    const posted = await recordPostForRecommendation(top.id);
    const clickDest = await ingestClick(posted.shortCode, { record: true, dedupeKey: "recon-click-1" });
    expect(clickDest).not.toBeNull();

    const signup = await recordSignup({
      touches: [posted.shortCode],
      projectId,
      ip: "203.0.113.10",
      userAgent: "Mozilla/5.0 (recon-test)",
      via: "beacon",
    });
    expect(signup).toMatchObject({ ok: true, attributed: true, mode: "last-touch" });

    // ── A survey answer naming a DIFFERENT channel than the click credited ────
    // Pick a taxonomy source whose platform differs from the tracked one.
    const reportedSource = ["reddit", "hackernews", "x", "producthunt", "linkedin"].find(
      (s) => sourcePlatform(s) && String(sourcePlatform(s)) !== trackedPlatform,
    )!;
    const reportedPlatform = String(sourcePlatform(reportedSource));
    const sr = await recordSelfReport(projectId, { answer: reportedSource });
    expect(sr.ok).toBe(true);

    // ── The blended view: both appear, neither is merged ─────────────────────
    const view = await getReconciledResults(projectId);

    const trackedRow = view.channels.find((c) => c.platform === trackedPlatform)!;
    expect(trackedRow).toBeTruthy();
    expect(trackedRow.trackedSignups).toBe(1);
    expect(trackedRow.reportedSignups).toBe(0);

    const reportedRow = view.channels.find((c) => c.platform === reportedPlatform)!;
    expect(reportedRow).toBeTruthy();
    expect(reportedRow.trackedSignups).toBe(0);
    expect(reportedRow.reportedSignups).toBe(1);

    // ── Totals reconcile within each system, nothing dropped/double-counted ──
    const sumTracked = view.channels.reduce((n, c) => n + c.trackedSignups, 0);
    const sumReported = view.channels.reduce((n, c) => n + c.reportedSignups, 0);
    expect(sumTracked).toBe(view.trackedAttributed);
    expect(sumReported).toBe(view.reportedAttributed);
    expect(view.trackedAttributed).toBe(1);
    expect(view.reportedAttributed).toBe(1);
    expect(view.totalTracked).toBe(view.trackedAttributed + view.darkSocial.trackedSignups);
    expect(view.totalReported).toBe(view.reportedAttributed + view.darkSocial.reportedSignups);
  });
});
