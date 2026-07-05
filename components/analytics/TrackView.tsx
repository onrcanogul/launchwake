"use client";

import { useEffect } from "react";
import type { ClientAnalyticsEvent } from "@/lib/analyticsEvents";

/**
 * Fire one funnel event when the page renders in a browser. Needed for pages
 * that are statically generated (e.g. the landing page), where a server-side
 * capture would only fire at build time. Renders nothing; failures are
 * silently ignored — analytics must never affect the page.
 */
export function TrackView({ event }: { event: ClientAnalyticsEvent }) {
  useEffect(() => {
    void trackClientEvent(event);
  }, [event]);
  return null;
}

/** Report a client-side funnel event to the beacon route. Fire-and-forget. */
export async function trackClientEvent(
  event: ClientAnalyticsEvent,
  properties?: Record<string, string | number | boolean>,
): Promise<void> {
  try {
    await fetch("/api/a", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, properties }),
      keepalive: true,
    });
  } catch {
    /* best-effort */
  }
}
