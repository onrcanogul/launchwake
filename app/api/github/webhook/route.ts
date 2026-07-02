import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { verifyWebhookSignature, parseWebhookEvent } from "@/lib/github";
import { runAnalysisJob } from "@/lib/jobs";
import { captureError } from "@/lib/observability";

/**
 * GitHub webhook → auto-detect ships (the retention engine). Matches the repo to
 * a project, verifies the signature against that project's own webhook secret,
 * creates a Ship, and analyzes it AFTER responding (so the webhook stays fast
 * and never times out). Never posts anything.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const eventType = req.headers.get("x-github-event");
  const signature = req.headers.get("x-hub-signature-256");

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const repoFullName = (payload as { repository?: { full_name?: string } })
    ?.repository?.full_name;
  if (!repoFullName) {
    return NextResponse.json({ ok: true, ignored: "no repository" });
  }

  const project = await db.project.findFirst({
    where: { githubRepo: { equals: repoFullName, mode: "insensitive" } },
  });
  if (!project) {
    return NextResponse.json({ ok: true, ignored: "no matching project" });
  }

  // Verify against the project's secret (or the deployment-wide fallback).
  const secret = project.webhookSecret ?? env.GITHUB_WEBHOOK_SECRET;
  if (secret) {
    if (!verifyWebhookSignature(rawBody, signature, secret)) {
      return NextResponse.json({ error: "Bad signature" }, { status: 401 });
    }
  } else if (env.NODE_ENV === "production") {
    // Never accept an unsigned webhook in production — that's a forged-Ship hole.
    // (In dev we allow it so you can curl the endpoint without a secret.)
    return NextResponse.json(
      { error: "Webhook signature required (configure GITHUB_WEBHOOK_SECRET)" },
      { status: 401 },
    );
  }

  if (eventType === "ping") {
    return NextResponse.json({ ok: true, pong: true });
  }

  const suggestion = parseWebhookEvent(eventType, payload);
  if (!suggestion) {
    return NextResponse.json({ ok: true, ignored: true });
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

  // Analyze after the response — keeps the webhook well under GitHub's timeout.
  after(async () => {
    try {
      await runAnalysisJob(ship.id);
    } catch (err) {
      captureError(err, { at: "github.webhook.analysis", shipId: ship.id });
    }
  });

  return NextResponse.json({ ok: true, shipId: ship.id });
}
