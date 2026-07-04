import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { withSentryConfig } from "@sentry/nextjs";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  /* config options here */
};

const base = withNextIntl(nextConfig);

// Only apply the Sentry build plugin when a DSN is configured. Without it the
// build is plugin-free — no source-map upload, no injected client SDK, no
// release management — so Sentry is effectively tree-shaken out of a DSN-less
// build. The runtime configs additionally no-op when their DSN is absent.
const sentryEnabled = Boolean(
  process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,
);

export default sentryEnabled
  ? withSentryConfig(base, {
      // Source-map upload (org/project/authToken) is optional; skipped when
      // SENTRY_AUTH_TOKEN is absent. Set SENTRY_ORG/SENTRY_PROJECT in CI to enable.
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      silent: !process.env.CI,
      widenClientFileUpload: true,
      // Route Sentry's browser requests through our origin to dodge ad blockers.
      tunnelRoute: "/monitoring",
      bundleSizeOptimizations: {
        excludeDebugStatements: true,
        excludeReplayShadowDom: true,
        excludeReplayIframe: true,
      },
      webpack: {
        automaticVercelMonitors: false,
        treeshake: { removeDebugLogging: true },
      },
    })
  : base;
