import Link from "next/link";

/**
 * Global 404 — same calm, on-brand card as the error boundary, so a mistyped
 * URL or a deleted ship never drops the user onto the raw Next.js screen.
 */
export default function NotFound() {
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
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.35-4.35" />
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
          Page not found
        </h1>
        <p style={{ fontSize: 13, color: "#9CA3B0", lineHeight: 1.6, margin: 0 }}>
          This page doesn&apos;t exist — the link may be old, or the ship or
          project it pointed to was removed.
        </p>
        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "center",
            marginTop: 20,
          }}
        >
          <Link
            href="/app"
            style={{
              background: "#3ECFB6",
              color: "#0A0B0F",
              borderRadius: 7,
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: 550,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            Go to dashboard
          </Link>
          <Link
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
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
