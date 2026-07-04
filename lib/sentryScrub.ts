import type { ErrorEvent, EventHint } from "@sentry/nextjs";

/**
 * Sentry PII scrubbing + noise filtering. Pure and dependency-free (types only)
 * so it can be imported by the client, server, AND edge Sentry configs without
 * dragging server modules into the browser bundle.
 *
 * Two jobs:
 *  - scrubEvent: strip PII before an event leaves the process — no emails, no
 *    tracked-link codes (which tie a click/signup to a real person), no auth
 *    headers or cookies.
 *  - shouldDropEvent: drop expected business errors (EntitlementError), Next.js
 *    control-flow signals (redirect / notFound), and known bot/404 noise on the
 *    /r/[code] redirector.
 */

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

// Query params that carry a tracked-link code (ties data to a user) or a secret.
const SENSITIVE_PARAM_RE = /([?&](?:lw_ref|ref|code|token|secret|api[-_]?key)=)[^&#\s]+/gi;

// A /r/{code} path segment is a tracked-link code — replace with a placeholder.
const TRACKED_PATH_RE = /\/r\/[A-Za-z0-9_-]{4,}/g;

// Object keys whose values must never be reported verbatim.
const SENSITIVE_KEY_RE =
  /^(cookie|set-cookie|authorization|auth|x-forwarded-for|forwarded|email|password|passwd|secret|token|lw_ref|api[-_]?key|stripe-signature|x-hub-signature(-256)?)$/i;

const BOT_UA_RE =
  /(bot|crawler|spider|crawl|slurp|bingpreview|facebookexternalhit|ahrefs|semrush|mj12|dotbot|petalbot|bytespider|gptbot|ccbot|headless|python-requests|curl|wget|scan)/i;

/** Redact emails and tracked-link codes/secrets inside a single string. */
export function scrubString(input: string): string {
  return input
    .replace(EMAIL_RE, "[redacted-email]")
    .replace(SENSITIVE_PARAM_RE, "$1[redacted]")
    .replace(TRACKED_PATH_RE, "/r/[code]");
}

function deepScrub(value: unknown, depth: number, seen: WeakSet<object>): void {
  if (depth > 8 || value === null || typeof value !== "object") return;
  if (seen.has(value as object)) return;
  seen.add(value as object);

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const v = value[i];
      if (typeof v === "string") value[i] = scrubString(v);
      else deepScrub(v, depth + 1, seen);
    }
    return;
  }

  const rec = value as Record<string, unknown>;
  for (const key of Object.keys(rec)) {
    if (SENSITIVE_KEY_RE.test(key)) {
      rec[key] = "[redacted]";
      continue;
    }
    const v = rec[key];
    if (typeof v === "string") rec[key] = scrubString(v);
    else deepScrub(v, depth + 1, seen);
  }
}

/**
 * Strip PII from an event in place. Never throws — a scrubbing bug must not stop
 * error reporting (and must never let an unscrubbed event through, so on failure
 * we still drop known-sensitive top-level fields).
 */
export function scrubEvent<T extends ErrorEvent>(event: T): T {
  try {
    deepScrub(event, 0, new WeakSet());
  } catch {
    // Fall through to the guaranteed top-level scrub below.
  }
  // Identity is never useful and always sensitive here.
  if (event.user) {
    delete event.user.email;
    delete event.user.ip_address;
    delete event.user.username;
  }
  return event;
}

function pathOf(url: string | undefined): string {
  if (!url) return "";
  try {
    return new URL(url, "http://internal").pathname;
  } catch {
    return "";
  }
}

function headerValue(
  headers: Record<string, string> | undefined,
  name: string,
): string {
  if (!headers) return "";
  const hit = Object.keys(headers).find((k) => k.toLowerCase() === name);
  return hit ? String(headers[hit]) : "";
}

function isNotFound(event: ErrorEvent, err: unknown): boolean {
  if (err instanceof Error) {
    if (err.name === "NotFoundError") return true;
    const digest = (err as { digest?: string }).digest;
    if (digest === "NEXT_NOT_FOUND") return true;
  }
  const status =
    event.contexts?.response?.status_code ??
    (event.tags?.["http.status_code"] as number | string | undefined);
  return status === 404 || status === "404";
}

/**
 * Decide whether to drop an event entirely (return true) before it's sent.
 */
export function shouldDropEvent(event: ErrorEvent, hint?: EventHint): boolean {
  const err = hint?.originalException;

  if (err instanceof Error) {
    // Expected, user-facing business error — not an incident.
    if (err.name === "EntitlementError") return true;
    // Next.js uses thrown "errors" for redirect() / notFound() control flow.
    const digest = (err as { digest?: string }).digest;
    if (typeof digest === "string" && (digest.startsWith("NEXT_REDIRECT") || digest === "NEXT_NOT_FOUND")) {
      return true;
    }
  }

  // Bot / 404 noise on the tracked-link redirector: crawlers hammer random
  // short codes, which is expected and not actionable.
  const headers = event.request?.headers as Record<string, string> | undefined;
  const path = pathOf(event.request?.url);
  if (path.startsWith("/r/")) {
    if (BOT_UA_RE.test(headerValue(headers, "user-agent"))) return true;
    if (isNotFound(event, err)) return true;
  }

  return false;
}
