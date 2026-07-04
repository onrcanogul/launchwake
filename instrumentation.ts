import * as Sentry from "@sentry/nextjs";

/**
 * Next.js instrumentation entry point. `register()` runs once per server runtime
 * and loads the matching Sentry config (each guards its own DSN, so this is inert
 * without one). `onRequestError` forwards otherwise-unhandled route / RSC /
 * server-action errors to Sentry — the catch-all for server-side failures.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
