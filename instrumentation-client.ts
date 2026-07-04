// Sentry initialization for the browser. Next.js loads this file on the client;
// the DSN is a NEXT_PUBLIC_ var so it's inlined at build time. When it's absent
// the `if (dsn)` branch is dead code the bundler can drop, and init never runs.
import * as Sentry from "@sentry/nextjs";
import { scrubEvent, shouldDropEvent } from "./lib/sentryScrub";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment:
      process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? "0.1"),
    // No session replay — avoids capturing user screens (privacy) and cost.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    sendDefaultPii: false,
    ignoreErrors: [
      // Browser-extension / benign runtime noise, not our bugs.
      "ResizeObserver loop limit exceeded",
      "ResizeObserver loop completed with undelivered notifications",
      /^Non-Error promise rejection captured/,
      "EntitlementError",
    ],
    beforeSend(event, hint) {
      if (shouldDropEvent(event, hint)) return null;
      return scrubEvent(event);
    },
  });
}

// Required by Next.js so Sentry can instrument client-side navigations. Safe to
// export even when uninitialized — it's a no-op without an active client.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
