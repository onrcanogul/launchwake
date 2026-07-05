import { env } from "./env";
import type { AnalyticsEvent } from "./analyticsEvents";

export { EVENTS, CLIENT_EVENTS, isClientEvent } from "./analyticsEvents";
export type { AnalyticsEvent, ClientAnalyticsEvent } from "./analyticsEvents";

/**
 * Product analytics — PostHog server-side capture for the activation funnel.
 *
 * Framework-agnostic: plain fetch against the PostHog capture API, no SDK, no
 * client bundle impact. Env-gated: when POSTHOG_API_KEY is absent every call is
 * a silent no-op, so dev/test/self-hosted deployments run identically.
 *
 * Privacy: the only identifier ever sent is the LaunchWake user id. Events with
 * no signed-in user get a throwaway `anon:` distinct id and are captured as
 * personless events (`$process_person_profile: false`) — no cookies, no IPs,
 * no emails.
 */

/** Primitive-only properties keep PII (objects, emails-in-arrays…) out by construction. */
export type AnalyticsProperties = Record<string, string | number | boolean | null>;

export type CaptureInput = {
  event: AnalyticsEvent;
  /** LaunchWake user id. Omit for anonymous (pre-auth) events. */
  distinctId?: string;
  properties?: AnalyticsProperties;
};

type CaptureConfig = {
  apiKey: string;
  host: string;
};

export type CapturePayload = {
  api_key: string;
  event: AnalyticsEvent;
  distinct_id: string;
  properties: AnalyticsProperties & { $process_person_profile?: boolean };
  timestamp: string;
};

export function analyticsEnabled(): boolean {
  return Boolean(env.POSTHOG_API_KEY);
}

/** Capture endpoint for a PostHog host (also normalizes a trailing slash). */
export function captureUrl(host: string): string {
  return `${host.replace(/\/$/, "")}/capture/`;
}

/**
 * Build the wire payload for one event. Pure — everything variable (config,
 * anon id, clock) is injected so it's unit-testable.
 */
export function buildCapturePayload(
  input: CaptureInput,
  cfg: CaptureConfig,
  opts: { anonId?: string; now?: Date } = {},
): CapturePayload {
  const anonymous = !input.distinctId;
  const distinctId =
    input.distinctId ?? `anon:${opts.anonId ?? crypto.randomUUID()}`;
  return {
    api_key: cfg.apiKey,
    event: input.event,
    distinct_id: distinctId,
    properties: {
      ...input.properties,
      // Anonymous events must not create person profiles (privacy + PostHog cost).
      ...(anonymous ? { $process_person_profile: false } : {}),
    },
    timestamp: (opts.now ?? new Date()).toISOString(),
  };
}

const CAPTURE_TIMEOUT_MS = 3_000;

/**
 * Send one event to PostHog. Best-effort by design: returns false (never
 * throws) when analytics is disabled or the request fails — losing a funnel
 * event must never affect the product path that emitted it.
 */
export async function capture(
  input: CaptureInput,
  cfg?: CaptureConfig,
): Promise<boolean> {
  const config =
    cfg ??
    (env.POSTHOG_API_KEY
      ? { apiKey: env.POSTHOG_API_KEY, host: env.POSTHOG_HOST }
      : null);
  if (!config) return false;

  try {
    const res = await fetch(captureUrl(config.host), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildCapturePayload(input, config)),
      signal: AbortSignal.timeout(CAPTURE_TIMEOUT_MS),
    });
    return res.ok;
  } catch {
    // Analytics outages are not app errors — swallow (no Sentry, no log spam).
    return false;
  }
}

/** Convenience: capture for a signed-in user. */
export async function captureUser(
  distinctId: string,
  event: AnalyticsEvent,
  properties?: AnalyticsProperties,
): Promise<boolean> {
  return capture({ event, distinctId, properties });
}

/** Convenience: capture an anonymous (personless) event. */
export async function captureAnon(
  event: AnalyticsEvent,
  properties?: AnalyticsProperties,
): Promise<boolean> {
  return capture({ event, properties });
}
