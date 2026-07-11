import type { Metadata } from "next";
import type { ReactNode } from "react";
import { DemoShell } from "@/components/demo/DemoShell";
import { TrackView } from "@/components/analytics/TrackView";
import { EVENTS } from "@/lib/analyticsEvents";

export const metadata: Metadata = {
  title: "Live demo — LaunchWake",
  description:
    "Explore LaunchWake with a fully worked example launch: where to post, how to post safely, and what drove signups. No account needed.",
  // A read-only sample surface — keep it out of the index; the real app is the product.
  robots: { index: false, follow: true },
};

/**
 * Public, login-less product tour. Sits OUTSIDE the `/app` auth middleware and
 * never calls `auth()`/`getWorkspace` — it renders the real components with fixed
 * mock data from `lib/demoData`, so it can't read or write a real account.
 */
export default function DemoLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {/* Funnel beacon — fires once when a visitor enters the demo, from any
          entry point (hero link, direct URL). The layout persists across tab
          navigations, so it isn't re-fired while clicking around. */}
      <TrackView event={EVENTS.demoOpened} />
      <DemoShell>{children}</DemoShell>
    </>
  );
}
