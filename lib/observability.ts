import * as Sentry from "@sentry/nextjs";

/**
 * Central error capture. Logs structured context and forwards to Sentry. When no
 * DSN is configured the SDK is never initialized, so the Sentry calls are inert
 * no-ops and only the console log remains — the app runs identically without it.
 *
 * Wire this at the seams where failures are otherwise swallowed — LLM calls,
 * webhook processing, attribution ingestion — so they become visible. PII is
 * scrubbed centrally in each Sentry config's `beforeSend` (see lib/sentryScrub),
 * so callers can pass context freely without leaking emails or tracked-link codes.
 */

type Context = Record<string, unknown>;

// Low-cardinality, high-signal keys worth indexing as searchable Sentry tags.
// Everything else in the context is attached as (searchable-in-body) extra data.
const TAG_KEYS = new Set([
  "at",
  "source",
  "projectId",
  "provider",
  "model",
  "tokens",
  "exhausted",
]);

/**
 * Record an error with context. Never throws — capturing an error must not cause
 * a second one.
 */
export function captureError(error: unknown, context: Context = {}): void {
  console.error("[error]", context, error);

  try {
    Sentry.withScope((scope) => {
      const extra: Context = {};
      for (const [key, value] of Object.entries(context)) {
        if (value === undefined || value === null) continue;
        if (
          TAG_KEYS.has(key) &&
          (typeof value === "string" || typeof value === "number" || typeof value === "boolean")
        ) {
          scope.setTag(key, String(value));
        } else {
          extra[key] = value;
        }
      }
      if (Object.keys(extra).length > 0) scope.setExtras(extra);
      Sentry.captureException(error);
    });
  } catch {
    // Reporting must never throw.
  }
}
