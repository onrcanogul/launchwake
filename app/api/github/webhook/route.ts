import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import {
  verifyWebhookSignatureAny,
  installationIdFromPayload,
} from "@/lib/github";
import { runWebhookShipJob } from "@/lib/jobs";
import { captureError } from "@/lib/observability";
import { hashPayload, recordDelivery, processDelivery } from "@/lib/webhookDelivery";

/**
 * GitHub webhook → auto-detect ships (the retention engine). Matches the repo to
 * a project, verifies the signature against that project's own webhook secret,
 * then persists the delivery and idempotently creates a Ship. Every authentic
 * delivery is logged as a `WebhookDelivery`, so a transient failure is retried by
 * the retry-webhooks cron instead of silently dropping a ship. Never posts.
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

  // App-installation deliveries carry an installation id. Prefer the project that
  // matches BOTH repo + installation (disambiguates the same repo across
  // accounts); fall back to repo-only for manual-webhook projects.
  const installationId = installationIdFromPayload(payload);
  const repoWhere = {
    githubRepo: { equals: repoFullName, mode: "insensitive" as const },
  };
  const project =
    (installationId
      ? await db.project.findFirst({
          where: { ...repoWhere, githubInstallationId: installationId },
        })
      : null) ?? (await db.project.findFirst({ where: repoWhere }));
  if (!project) {
    return NextResponse.json({ ok: true, ignored: "no matching project" });
  }

  // Verify against any applicable secret: the project's manual secret, the App's
  // webhook secret (installation deliveries), or the deployment-wide fallback.
  const secrets = [
    project.webhookSecret,
    env.GITHUB_APP_WEBHOOK_SECRET,
    env.GITHUB_WEBHOOK_SECRET,
  ];
  if (secrets.some(Boolean)) {
    if (!verifyWebhookSignatureAny(rawBody, signature, secrets)) {
      return NextResponse.json({ error: "Bad signature" }, { status: 401 });
    }
  } else if (env.NODE_ENV === "production") {
    // Never accept an unsigned webhook in production — that's a forged-Ship hole.
    // (In dev we allow it so you can curl the endpoint without a secret.)
    return NextResponse.json(
      { error: "Webhook signature required (configure a webhook secret)" },
      { status: 401 },
    );
  }

  if (eventType === "ping") {
    return NextResponse.json({ ok: true, pong: true });
  }

  // Persist the (authentic) delivery, then process it idempotently. The dedupe
  // key is a hash of the raw body, so GitHub re-deliveries of the same payload
  // resolve to one row — and one Ship.
  const { delivery, isNew } = await recordDelivery({
    source: "GITHUB",
    dedupeKey: hashPayload(rawBody),
    projectId: project.id,
    eventType,
    payload,
    signature,
  });

  const outcome = await processDelivery(delivery);

  // Analyze + notify after the response — keeps the webhook well under
  // GitHub's timeout. The job respects plan entitlements and emails "your
  // distribution plan is ready" (the release → return loop).
  if (outcome.created && outcome.shipId) {
    const shipId = outcome.shipId;
    after(async () => {
      try {
        await runWebhookShipJob(shipId);
      } catch (err) {
        captureError(err, { at: "github.webhook.analysis", shipId });
      }
    });
  }

  return NextResponse.json({
    ok: outcome.status !== "FAILED",
    deliveryId: delivery.id,
    shipId: outcome.shipId,
    status: outcome.status,
    deduped: outcome.deduped || !isNew,
  });
}
