import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { verifyWebhookSignature, parseWebhookEvent } from "@/lib/github";
import { runAnalysisJob } from "@/lib/jobs";

/**
 * GitHub webhook → auto-detect ships. Verifies the HMAC signature, turns a
 * release/push into a Ship on the matching project, and kicks off analysis.
 * Never posts anything — it only creates the distribution moment.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const eventType = req.headers.get("x-github-event");

  // Signature check (required when a secret is configured).
  if (env.GITHUB_WEBHOOK_SECRET) {
    const ok = verifyWebhookSignature(
      rawBody,
      req.headers.get("x-hub-signature-256"),
      env.GITHUB_WEBHOOK_SECRET,
    );
    if (!ok) {
      return NextResponse.json({ error: "Bad signature" }, { status: 401 });
    }
  }

  if (eventType === "ping") {
    return NextResponse.json({ ok: true, pong: true });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const suggestion = parseWebhookEvent(eventType, payload);
  if (!suggestion) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  // Match the repo to a project (case-insensitive owner/repo).
  const project = await db.project.findFirst({
    where: { githubRepo: { equals: suggestion.repoFullName, mode: "insensitive" } },
  });
  if (!project) {
    return NextResponse.json({ ok: true, ignored: "no matching project" });
  }

  const ship = await db.ship.create({
    data: {
      projectId: project.id,
      type: suggestion.type,
      title: suggestion.title,
      summary: suggestion.summary,
      sourceUrl: suggestion.sourceUrl,
      commitSha: suggestion.commitSha,
    },
  });

  // Analyze (inline for MVP; a no-op-safe seam for Inngest later).
  await runAnalysisJob(ship.id).catch((err) => {
    console.error(`[webhook] analysis failed for ship ${ship.id}:`, err);
  });

  return NextResponse.json({ ok: true, shipId: ship.id });
}
