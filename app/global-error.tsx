"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

/**
 * Global error boundary — the last resort when the root layout itself throws.
 * It replaces the whole document, so it renders its own <html>/<body> and
 * inlines all styles (globals.css isn't loaded here). Reports to Sentry and
 * shows the same on-brand fallback rather than the default white error screen.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          background: "#0A0B0F",
          color: "#E7E9ED",
          fontFamily:
            "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: 440,
            width: "100%",
            textAlign: "center",
            border: "1px solid rgba(255,255,255,.07)",
            background: "#0D0F14",
            borderRadius: 12,
            padding: 32,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              margin: "0 auto",
              borderRadius: 10,
              background: "#15181E",
              border: "1px solid rgba(255,255,255,.07)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#9CA3B0",
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
            </svg>
          </div>
          <h1
            style={{
              fontSize: 19,
              fontWeight: 600,
              letterSpacing: "-0.01em",
              margin: "16px 0 6px",
            }}
          >
            Something went wrong
          </h1>
          <p style={{ fontSize: 13, color: "#9CA3B0", lineHeight: 1.6, margin: 0 }}>
            LaunchWake hit an unexpected error. It&apos;s been logged and we&apos;re
            looking into it — please try again.
          </p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 20 }}>
            <button
              onClick={reset}
              style={{
                background: "#3ECFB6",
                color: "#0A0B0F",
                border: "none",
                borderRadius: 7,
                padding: "8px 16px",
                fontSize: 13,
                fontWeight: 550,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            {/* A hard navigation (full reload) intentionally discards the
                crashed React tree — safer here than a client-side <Link>. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              style={{
                color: "#E7E9ED",
                border: "1px solid rgba(255,255,255,.11)",
                borderRadius: 7,
                padding: "8px 16px",
                fontSize: 13,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              Go home
            </a>
          </div>
          {error.digest && (
            <div
              style={{
                marginTop: 16,
                fontSize: 11.5,
                color: "#646B79",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
              }}
            >
              Ref: {error.digest}
            </div>
          )}
        </div>
      </body>
    </html>
  );
}
