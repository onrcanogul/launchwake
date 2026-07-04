import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { processGithubWebhook } from "@/lib/githubWebhook";
import { runGithubAnalysisResilient } from "@/lib/jobs";

/**
 * GitHub webhook → auto-detect ships (the retention engine). Matches the repo to
 * a project, verifies the signature against that project's own webhook secret,
 * creates a Ship, and analyzes it AFTER responding (so the webhook stays fast
 * and never times out). Resilient: analysis retries and, if it still fails, the
 * delivery is persisted for the retry cron so a hiccup never silently loses the
 * plan. Never posts anything.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const result = await processGithubWebhook({
    rawBody,
    eventType: req.headers.get("x-github-event"),
    signature: req.headers.get("x-hub-signature-256"),
  });

  if (result.ship) {
    const { id, projectId, eventType } = result.ship;
    after(() => runGithubAnalysisResilient(id, { projectId, eventType }));
  }

  return NextResponse.json(result.body, { status: result.status });
}
