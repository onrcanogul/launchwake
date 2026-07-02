import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/Icon";

/**
 * Chrome for the public, login-less pages (Launch Checker, Ban Risk Lookup).
 * A sticky top bar + centered column + footer — no app sidebar. Same tokens as
 * the app so the two never look like different products.
 */
export function PublicShell({
  children,
  wide,
}: {
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="pub">
      <header className="pub-bar">
        <Link href="/" className="pub-brand">
          <Icon name="wave" />
          LaunchWake
        </Link>
        <nav className="pub-nav">
          <Link href="/tools/launch-checker">Launch Checker</Link>
          <Link href="/channels">Channels</Link>
          <Link href="/state-of-developer-launches">Report</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/login" className="cta">
            Sign in
          </Link>
        </nav>
      </header>

      <main className={wide ? "pub-wrap wide" : "pub-wrap"}>{children}</main>

      <footer className="pub-foot">
        <span>© LaunchWake — distribution intelligence for technical founders.</span>
        <span>
          <Link href="/tools/launch-checker">Launch Checker</Link>
          {" · "}
          <Link href="/channels">Channels</Link>
          {" · "}
          <Link href="/state-of-developer-launches">State of Launches</Link>
          {" · "}
          <Link href="/pricing">Pricing</Link>
          {" · "}
          <Link href="/changelog">Changelog</Link>
        </span>
      </footer>
    </div>
  );
}
