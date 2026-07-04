"use client";

import { useEffect } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";

/**
 * Route-level error boundary. Reports the error to Sentry (no-op without a DSN)
 * and shows a calm, on-brand fallback — never a raw Next.js stack-trace screen.
 */
export default function Error({
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
    <div
      style={{
        minHeight: "70vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        color: "#E7E9ED",
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
          An unexpected error occurred on this page. It&apos;s been logged and
          we&apos;re looking into it — try again, or head back to your dashboard.
        </p>
        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "center",
            marginTop: 20,
          }}
        >
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
          <Link
            href="/app"
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
            Go to dashboard
          </Link>
        </div>
        {error.digest && (
          <div
            style={{
              marginTop: 16,
              fontSize: 11.5,
              color: "#646B79",
              fontFamily:
                "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
            }}
          >
            Ref: {error.digest}
          </div>
        )}
      </div>
    </div>
  );
}
