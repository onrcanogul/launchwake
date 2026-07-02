import { env } from "./env";

/**
 * Central error capture. Today it logs structured context; when `SENTRY_DSN` is
 * set and `@sentry/nextjs` is installed, it also forwards to Sentry (loaded
 * lazily so the package stays an optional dependency). Wire this at the seams
 * where failures are otherwise swallowed — LLM JSON parsing, webhooks, the
 * redirect — so they become visible instead of silent.
 *
 * To fully enable Sentry: `pnpm add @sentry/nextjs`, set `SENTRY_DSN`, and add
 * an `instrumentation.ts` that calls `Sentry.init({ dsn: env.SENTRY_DSN })`.
 */

type Context = Record<string, unknown>;

// Cache the optional Sentry module (or `null` if unavailable) after first load.
let sentry: { captureException: (e: unknown, hint?: unknown) => void } | null | undefined;

// Indirect specifier: keeps `@sentry/nextjs` an OPTIONAL dependency — a literal
// import would fail typecheck/build until it's installed.
const SENTRY_PKG = "@sentry/nextjs";

async function loadSentry() {
  if (sentry !== undefined) return sentry;
  if (!env.SENTRY_DSN) return (sentry = null);
  try {
    sentry = (await import(/* webpackIgnore: true */ SENTRY_PKG)) as never;
  } catch {
    sentry = null;
  }
  return sentry;
}

/**
 * Record an error with context. Never throws — capturing an error must not
 * cause a second one. Returns immediately; Sentry forwarding is fire-and-forget.
 */
export function captureError(error: unknown, context: Context = {}): void {
  console.error("[error]", context, error);
  void loadSentry()
    .then((s) => s?.captureException(error, { extra: context }))
    .catch(() => {});
}
