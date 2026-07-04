// Sentry initialization for the Node.js server runtime (route handlers, RSC,
// server actions, cron, webhooks). Loaded by instrumentation.ts's register().
// No DSN → init is skipped and the SDK stays a no-op (see next.config.ts, which
// also drops the build plugin when no DSN is set).
import * as Sentry from "@sentry/nextjs";
import { scrubEvent, shouldDropEvent } from "./lib/sentryScrub";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment:
      process.env.SENTRY_ENVIRONMENT ?? process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.1"),
    // We scrub PII ourselves; never let the SDK attach IPs / request bodies.
    sendDefaultPii: false,
    ignoreErrors: [
      // Expected business error (also dropped by shouldDropEvent as defense).
      "EntitlementError",
    ],
    beforeSend(event, hint) {
      if (shouldDropEvent(event, hint)) return null;
      return scrubEvent(event);
    },
  });
}
