import { createHash } from "crypto";
import type { Prisma, WebhookDelivery, WebhookSource } from "@prisma/client";
import { db } from "./db";
import { captureError } from "./observability";
import { parseWebhookEvent } from "./github";
import { parseStripeRevenue } from "./stripeRevenue";
import { ingestRevenue } from "./attribution";

/**
 * Webhook ingestion resilience. Every authentic GitHub/Stripe delivery is
 * persisted as a `WebhookDelivery` before its effect runs, so a transient
 * failure becomes a retryable row instead of a silent gap in a founder's data.
 *
 * The pure helpers (hash, backoff schedule) are unit-tested directly; the DB
 * orchestration takes an injectable `client` (defaults to the shared Prisma
 * singleton) so the idempotency + retry logic is testable against an in-memory
 * store without a live Postgres.
 */

/** A failed delivery is retried up to this many total attempts, then parked. */
export const MAX_WEBHOOK_ATTEMPTS = 5;

/** Base backoff before the first retry; doubles each subsequent attempt. */
const BACKOFF_BASE_MS = 60_000; // 1 min
/** Cap so a long-parked row doesn't schedule its retry hours out. */
const BACKOFF_MAX_MS = 60 * 60_000; // 1 hour

// ── Pure helpers (unit-tested) ─────────────────────────────

/** Stable idempotency key for a raw body — sha256 hex. */
export function hashPayload(rawBody: string): string {
  return createHash("sha256").update(rawBody).digest("hex");
}

/**
 * Exponential backoff (ms) to wait before the retry that follows `attempts`
 * failures. attempts=1 → 1m, 2 → 2m, 3 → 4m, 4 → 8m, capped at BACKOFF_MAX_MS.
 */
export function computeBackoffMs(attempts: number): number {
  const n = Math.max(1, Math.floor(attempts));
  return Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** (n - 1));
}

/** Absolute time a delivery becomes eligible for its next retry. */
export function computeNextRetryAt(attempts: number, from: Date): Date {
  return new Date(from.getTime() + computeBackoffMs(attempts));
}

/** Whether a FAILED delivery is due for another attempt at `now`. */
export function isRetryDue(
  d: Pick<WebhookDelivery, "status" | "attempts" | "nextRetryAt">,
  now: Date,
): boolean {
  return (
    d.status === "FAILED" &&
    d.attempts < MAX_WEBHOOK_ATTEMPTS &&
    d.nextRetryAt != null &&
    d.nextRetryAt.getTime() <= now.getTime()
  );
}

// ── Persistence (DB) ───────────────────────────────────────

type Db = typeof db;

export type RecordDeliveryInput = {
  source: WebhookSource;
  dedupeKey: string;
  projectId?: string | null;
  eventType?: string | null;
  payload: unknown;
  signature?: string | null;
};

export type RecordedDelivery = { delivery: WebhookDelivery; isNew: boolean };

/**
 * Persist an inbound delivery as RECEIVED, keyed by (source, dedupeKey). If a
 * row already exists (a re-delivery of the same payload / event id), the
 * existing row is returned untouched — that's the first line of idempotency.
 */
export async function recordDelivery(
  input: RecordDeliveryInput,
  client: Db = db,
): Promise<RecordedDelivery> {
  const where = {
    source_dedupeKey: { source: input.source, dedupeKey: input.dedupeKey },
  } as const;

  const existing = await client.webhookDelivery.findUnique({ where });
  if (existing) return { delivery: existing, isNew: false };

  try {
    const delivery = await client.webhookDelivery.create({
      data: {
        source: input.source,
        dedupeKey: input.dedupeKey,
        projectId: input.projectId ?? null,
        eventType: input.eventType ?? null,
        payload: (input.payload ?? {}) as Prisma.InputJsonValue,
        signature: input.signature ?? null,
      },
    });
    return { delivery, isNew: true };
  } catch (err) {
    // Lost a create race on the unique key — re-read the winner.
    const again = await client.webhookDelivery.findUnique({ where });
    if (again) return { delivery: again, isNew: false };
    throw err;
  }
}

export type ProcessOutcome = {
  status: "PROCESSED" | "FAILED";
  shipId: string | null;
  /** True only when THIS call created a new Ship (drives analysis + dedupe). */
  created: boolean;
  /** Stripe: whether the payment was attributed to a channel. */
  attributed?: boolean;
  /** True when we short-circuited an already-PROCESSED row. */
  deduped: boolean;
  attempts?: number;
  exhausted?: boolean;
  error?: string;
};

/**
 * Idempotently apply a delivery's effect and record the outcome. Safe to call
 * repeatedly on the same row: an already-PROCESSED delivery is a no-op, and the
 * per-source effects dedupe on their own natural keys (commit/source URL for
 * GitHub, the tracked-link + event id for Stripe). Never throws — failures are
 * persisted as FAILED with a backoff and surfaced, not swallowed.
 */
export async function processDelivery(
  delivery: WebhookDelivery,
  client: Db = db,
): Promise<ProcessOutcome> {
  if (delivery.status === "PROCESSED") {
    return { status: "PROCESSED", shipId: delivery.shipId, created: false, deduped: true };
  }

  try {
    const effect =
      delivery.source === "GITHUB"
        ? await applyGithubDelivery(delivery, client)
        : await applyStripeDelivery(delivery, client);

    await client.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        status: "PROCESSED",
        processedAt: new Date(),
        attempts: delivery.attempts + 1,
        error: null,
        nextRetryAt: null,
        shipId: effect.shipId ?? null,
      },
    });

    return {
      status: "PROCESSED",
      shipId: effect.shipId ?? null,
      created: effect.created ?? false,
      attributed: effect.attributed,
      deduped: false,
    };
  } catch (err) {
    const attempts = delivery.attempts + 1;
    const exhausted = attempts >= MAX_WEBHOOK_ATTEMPTS;
    const message = String((err as Error)?.message ?? err).slice(0, 500);

    await client.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        status: "FAILED",
        attempts,
        error: message,
        nextRetryAt: exhausted ? null : computeNextRetryAt(attempts, new Date()),
      },
    });
    captureError(err, {
      at: `webhook.process.${delivery.source.toLowerCase()}`,
      deliveryId: delivery.id,
      attempts,
      exhausted,
    });

    return {
      status: "FAILED",
      shipId: null,
      created: false,
      deduped: false,
      attempts,
      exhausted,
      error: message,
    };
  }
}

type EffectResult = { shipId?: string | null; created?: boolean; attributed?: boolean };

/**
 * GitHub effect: turn a release/push payload into a Ship. Idempotent — a Ship
 * already recorded for the same commit (push) or source URL (release) is reused,
 * so a retry or re-delivery never creates a duplicate.
 */
async function applyGithubDelivery(
  delivery: WebhookDelivery,
  client: Db,
): Promise<EffectResult> {
  if (!delivery.projectId) return { shipId: null, created: false };

  const suggestion = parseWebhookEvent(delivery.eventType, delivery.payload);
  if (!suggestion) return { shipId: null, created: false }; // ignored event → PROCESSED

  const dedupeClauses: Prisma.ShipWhereInput[] = [];
  if (suggestion.commitSha) dedupeClauses.push({ commitSha: suggestion.commitSha });
  if (suggestion.sourceUrl) dedupeClauses.push({ sourceUrl: suggestion.sourceUrl });

  if (dedupeClauses.length > 0) {
    const existing = await client.ship.findFirst({
      where: { projectId: delivery.projectId, OR: dedupeClauses },
      select: { id: true },
    });
    if (existing) return { shipId: existing.id, created: false };
  }

  const ship = await client.ship.create({
    data: {
      projectId: delivery.projectId,
      type: suggestion.type,
      title: suggestion.title,
      summary: suggestion.summary,
      sourceUrl: suggestion.sourceUrl,
      commitSha: suggestion.commitSha,
    },
    select: { id: true },
  });
  return { shipId: ship.id, created: true };
}

/**
 * Stripe effect: attribute a payment to the channel that drove it. Idempotency
 * is guaranteed upstream by the unique (STRIPE, event.id) delivery row + the
 * PROCESSED short-circuit, so the payment is counted at most once.
 */
async function applyStripeDelivery(
  delivery: WebhookDelivery,
  client: Db,
): Promise<EffectResult> {
  const event = delivery.payload as unknown as {
    type: string;
    data: { object: unknown };
  };
  const revenue = parseStripeRevenue(event);
  if (!revenue) return { shipId: null, created: false, attributed: false };

  const attributed = await ingestRevenue(
    revenue.ref,
    {
      amountCents: revenue.amountCents,
      currency: revenue.currency,
      recurring: revenue.recurring,
      meta: { via: "stripe", eventType: event.type, eventId: delivery.dedupeKey },
    },
    client,
  );
  return { shipId: null, created: false, attributed };
}

// ── Retry cron worker ──────────────────────────────────────

export type RetrySummary = {
  attempted: number;
  processed: number;
  stillFailing: number;
  exhausted: number;
  /** Ships freshly created by a successful retry — the caller runs analysis. */
  analyzedShipIds: string[];
};

/**
 * Reprocess FAILED deliveries whose backoff has elapsed (oldest first). Rows
 * that hit MAX_WEBHOOK_ATTEMPTS are parked (nextRetryAt cleared) and no longer
 * selected. Returns a summary + the ships created so the caller can analyze them.
 */
export async function retryFailedDeliveries(
  now: Date = new Date(),
  client: Db = db,
  limit = 25,
): Promise<RetrySummary> {
  const due = await client.webhookDelivery.findMany({
    where: {
      status: "FAILED",
      attempts: { lt: MAX_WEBHOOK_ATTEMPTS },
      nextRetryAt: { lte: now },
    },
    orderBy: { nextRetryAt: "asc" },
    take: limit,
  });

  let processed = 0;
  let stillFailing = 0;
  let exhausted = 0;
  const analyzedShipIds: string[] = [];

  for (const delivery of due) {
    const outcome = await processDelivery(delivery, client);
    if (outcome.status === "PROCESSED") {
      processed += 1;
      if (outcome.created && outcome.shipId) analyzedShipIds.push(outcome.shipId);
    } else {
      stillFailing += 1;
      if (outcome.exhausted) exhausted += 1;
    }
  }

  return { attempted: due.length, processed, stillFailing, exhausted, analyzedShipIds };
}
