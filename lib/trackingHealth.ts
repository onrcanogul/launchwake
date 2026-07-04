import type { WebhookSourceHealth } from "./webhookDelivery";

/**
 * The "Tracking health" card composer (Settings). Turns the raw attribution +
 * webhook signals into a small set of status rows so a founder can tell, at a
 * glance, whether clicks, signups, and the GitHub/Stripe webhooks are actually
 * flowing — and see when something last succeeded or failed. Pure → unit-tested.
 */

export type HealthTone = "ok" | "warn" | "idle";

export type HealthRow = {
  key: string;
  label: string;
  tone: HealthTone;
  /** primary message, without a relative time (the UI appends "· last X ago"). */
  detail: string;
  /** timestamp to render as "· last X ago", or null. */
  at: Date | null;
  /** failure detail, when the row is a warning. */
  error?: string | null;
};

export type TrackingHealthInput = {
  clicks: number;
  signups: number;
  lastClickAt: Date | null;
  lastSignupAt: Date | null;
  github: {
    connected: boolean;
    /** last auto-detected ship — a successful webhook delivery. */
    lastSuccessAt: Date | null;
    failure: WebhookSourceHealth;
  };
  stripe: {
    configured: boolean;
    /** last attributed revenue event — a successful webhook delivery. */
    lastSuccessAt: Date | null;
    failure: WebhookSourceHealth;
  };
};

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function deliveries(n: number): string {
  return `${n} failed deliver${n === 1 ? "y" : "ies"}`;
}

export function trackingHealthRows(input: TrackingHealthInput): HealthRow[] {
  const rows: HealthRow[] = [];

  // 1) Click tracking (the /r/{code} redirect).
  rows.push(
    input.clicks > 0
      ? {
          key: "clicks",
          label: "Click tracking",
          tone: "ok",
          detail: `Working — ${plural(input.clicks, "click")} tracked`,
          at: input.lastClickAt,
        }
      : {
          key: "clicks",
          label: "Click tracking",
          tone: "idle",
          detail: "No clicks yet — share a tracked link to start",
          at: null,
        },
  );

  // 2) Signup pixel — a signup event means it has fired.
  if (input.signups > 0) {
    rows.push({
      key: "pixel",
      label: "Signup pixel",
      tone: "ok",
      detail: `Firing — ${plural(input.signups, "signup")} attributed`,
      at: input.lastSignupAt,
    });
  } else if (input.clicks > 0) {
    rows.push({
      key: "pixel",
      label: "Signup pixel",
      tone: "warn",
      detail:
        "Clicks arriving but no signups — check the pixel is on your success page",
      at: null,
    });
  } else {
    rows.push({
      key: "pixel",
      label: "Signup pixel",
      tone: "idle",
      detail: "Not detected yet — add the snippet below",
      at: null,
    });
  }

  // 3) GitHub auto-detect webhook.
  if (!input.github.connected) {
    rows.push({
      key: "github",
      label: "GitHub webhook",
      tone: "idle",
      detail: "Not connected",
      at: null,
    });
  } else if (input.github.failure.failures > 0) {
    rows.push({
      key: "github",
      label: "GitHub webhook",
      tone: "warn",
      detail: `${deliveries(input.github.failure.failures)} — retrying`,
      at: input.github.failure.lastFailureAt,
      error: input.github.failure.lastError,
    });
  } else if (input.github.lastSuccessAt) {
    rows.push({
      key: "github",
      label: "GitHub webhook",
      tone: "ok",
      detail: "Delivering — last ship",
      at: input.github.lastSuccessAt,
    });
  } else {
    rows.push({
      key: "github",
      label: "GitHub webhook",
      tone: "idle",
      detail: "Connected — no ships detected yet",
      at: null,
    });
  }

  // 4) Stripe revenue webhook.
  if (!input.stripe.configured) {
    rows.push({
      key: "stripe",
      label: "Stripe revenue webhook",
      tone: "idle",
      detail: "Not configured",
      at: null,
    });
  } else if (input.stripe.failure.failures > 0) {
    rows.push({
      key: "stripe",
      label: "Stripe revenue webhook",
      tone: "warn",
      detail: `${deliveries(input.stripe.failure.failures)}`,
      at: input.stripe.failure.lastFailureAt,
      error: input.stripe.failure.lastError,
    });
  } else if (input.stripe.lastSuccessAt) {
    rows.push({
      key: "stripe",
      label: "Stripe revenue webhook",
      tone: "ok",
      detail: "Receiving — last payment",
      at: input.stripe.lastSuccessAt,
    });
  } else {
    rows.push({
      key: "stripe",
      label: "Stripe revenue webhook",
      tone: "idle",
      detail: "Connected — no payments yet",
      at: null,
    });
  }

  return rows;
}
