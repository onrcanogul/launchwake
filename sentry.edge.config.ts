// Sentry initialization for the Edge runtime (middleware + edge routes). Loaded
// by instrumentation.ts's register(). No DSN → init is skipped (no-op SDK).
import * as Sentry from "@sentry/nextjs";
import { scrubEvent, shouldDropEvent } from "./lib/sentryScrub";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment:
      process.env.SENTRY_ENVIRONMENT ?? process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.1"),
    sendDefaultPii: false,
    ignoreErrors: ["EntitlementError"],
    beforeSend(event, hint) {
      if (shouldDropEvent(event, hint)) return null;
      return scrubEvent(event);
    },
  });
}
