import { db } from "./db";
import { env } from "./env";
import { verifyWebhookSignature, parseWebhookEvent } from "./github";

/**
 * Core of the GitHub auto-detect webhook, extracted from the route so it's
 * integration-testable (mock ./db) and the route stays a thin HTTP shell. Match
 * the repo → project, verify the signature, parse the event, create the Ship.
 * Returns the ship context so the route can schedule resilient analysis after
 * the response. Never posts anything.
 */
export type GithubWebhookResult = {
  status: number;
  body: Record<string, unknown>;
  /** present only when a ship was created — the route analyzes it after responding. */
  ship?: { id: string; projectId: string; eventType: string | null };
};

export async function processGithubWebhook(input: {
  rawBody: string;
  eventType: string | null;
  signature: string | null;
}): Promise<GithubWebhookResult> {
  let payload: unknown;
  try {
    payload = JSON.parse(input.rawBody);
  } catch {
    return { status: 400, body: { error: "Invalid JSON" } };
  }

  const repoFullName = (payload as { repository?: { full_name?: string } })
    ?.repository?.full_name;
  if (!repoFullName) {
    return { status: 200, body: { ok: true, ignored: "no repository" } };
  }

  const project = await db.project.findFirst({
    where: { githubRepo: { equals: repoFullName, mode: "insensitive" } },
  });
  if (!project) {
    return { status: 200, body: { ok: true, ignored: "no matching project" } };
  }

  // Verify against the project's secret (or the deployment-wide fallback).
  const secret = project.webhookSecret ?? env.GITHUB_WEBHOOK_SECRET;
  if (secret) {
    if (!verifyWebhookSignature(input.rawBody, input.signature, secret)) {
      return { status: 401, body: { error: "Bad signature" } };
    }
  } else if (env.NODE_ENV === "production") {
    // Never accept an unsigned webhook in production — that's a forged-Ship hole.
    return {
      status: 401,
      body: {
        error: "Webhook signature required (configure GITHUB_WEBHOOK_SECRET)",
      },
    };
  }

  if (input.eventType === "ping") {
    return { status: 200, body: { ok: true, pong: true } };
  }

  const suggestion = parseWebhookEvent(input.eventType, payload);
  if (!suggestion) {
    return { status: 200, body: { ok: true, ignored: true } };
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

  return {
    status: 200,
    body: { ok: true, shipId: ship.id },
    ship: { id: ship.id, projectId: project.id, eventType: input.eventType },
  };
}
