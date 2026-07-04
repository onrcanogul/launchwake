import { db } from "./db";
import { captureError } from "./observability";
import type { WebhookSource } from "@prisma/client";

/**
 * Resilient webhook processing: retry transient failures with backoff, and
 * persist the ones that still fail so (a) the founder can see them in Settings
 * and (b) a cron can re-drive retryable ones. Silent ingestion loss is the worst
 * failure mode for an attribution product — a dead channel that actually worked.
 *
 * The pure pieces (backoff schedule, withRetry) are unit-tested; the DB helpers
 * are thin and best-effort.
 */

// Exponential, capped backoff for the durable (cron) retry: attempt 1 → 1m,
// 2 → 5m, 3 → 15m, 4 → 30m, 5+ → 60m.
const BACKOFF_MINUTES = [1, 5, 15, 30, 60];

/** Give up (dead-letter) after this many total attempts. */
export const MAX_WEBHOOK_ATTEMPTS = 5;

/** Delay before the next durable retry of a delivery on its Nth attempt. Pure. */
export function retryDelayMs(attempt: number): number {
  const idx = Math.min(Math.max(1, attempt), BACKOFF_MINUTES.length) - 1;
  return BACKOFF_MINUTES[idx] * 60_000;
}

const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export type WithRetryOpts = {
  /** total tries including the first (default 3). */
  attempts?: number;
  /** delay before the FIRST retry, doubled each subsequent retry (default 300ms). */
  baseDelayMs?: number;
  /** injectable sleep (tests pass a no-op to avoid real timers). */
  sleep?: (ms: number) => Promise<void>;
  onError?: (err: unknown, attempt: number) => void;
};

/**
 * Run `fn`, retrying on throw with exponential in-process backoff. Returns the
 * result or throws the last error once attempts are exhausted. This handles
 * blips; the durable cross-request retry is the persisted delivery + cron.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: WithRetryOpts = {},
): Promise<T> {
  const attempts = Math.max(1, opts.attempts ?? 3);
  const base = opts.baseDelayMs ?? 300;
  const sleep = opts.sleep ?? realSleep;
  let lastErr: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      opts.onError?.(err, i);
      if (i < attempts) await sleep(base * 2 ** (i - 1));
    }
  }
  throw lastErr;
}

export type WebhookFailureInput = {
  source: WebhookSource;
  projectId?: string | null;
  eventType?: string | null;
  shipId?: string | null;
  attempts: number;
  error: string;
  /** when true, set nextRetryAt so the cron re-drives it (until dead-lettered). */
  retryable?: boolean;
  now?: Date;
};

/**
 * Persist a failed webhook delivery. Retryable failures get a nextRetryAt from
 * the backoff schedule until they hit MAX_WEBHOOK_ATTEMPTS (then dead-lettered
 * with nextRetryAt=null). Never throws to the caller.
 */
export async function recordWebhookFailure(
  input: WebhookFailureInput,
): Promise<void> {
  const now = input.now ?? new Date();
  const nextRetryAt =
    input.retryable && input.attempts < MAX_WEBHOOK_ATTEMPTS
      ? new Date(now.getTime() + retryDelayMs(input.attempts))
      : null;
  try {
    await db.webhookDelivery.create({
      data: {
        source: input.source,
        projectId: input.projectId ?? null,
        eventType: input.eventType ?? null,
        shipId: input.shipId ?? null,
        status: "FAILED",
        attempts: input.attempts,
        error: input.error.slice(0, 500),
        nextRetryAt,
      },
    });
  } catch (err) {
    captureError(err, { at: "webhookDelivery.recordFailure", source: input.source });
  }
}

export type WebhookSourceHealth = {
  failures: number;
  lastFailureAt: Date | null;
  lastError: string | null;
};

export type WebhookFailureHealth = {
  GITHUB: WebhookSourceHealth;
  STRIPE_REVENUE: WebhookSourceHealth;
};

const emptyHealth = (): WebhookSourceHealth => ({
  failures: 0,
  lastFailureAt: null,
  lastError: null,
});

/**
 * Outstanding (still-FAILED) webhook failures per source for a project — feeds
 * the Settings "Tracking health" card so a founder can see something broke.
 */
export async function getWebhookFailureHealth(
  projectId: string,
): Promise<WebhookFailureHealth> {
  const rows = await db.webhookDelivery.findMany({
    where: { projectId, status: "FAILED" },
    orderBy: { createdAt: "desc" },
    select: { source: true, error: true, createdAt: true },
  });
  const out: WebhookFailureHealth = {
    GITHUB: emptyHealth(),
    STRIPE_REVENUE: emptyHealth(),
  };
  for (const r of rows) {
    const h = out[r.source];
    if (!h) continue;
    h.failures += 1;
    if (h.lastFailureAt === null) {
      h.lastFailureAt = r.createdAt;
      h.lastError = r.error;
    }
  }
  return out;
}
