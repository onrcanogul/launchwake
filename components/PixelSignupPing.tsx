"use client";

import { useEffect } from "react";

/**
 * Fires the LaunchWake attribution pixel's `launchwakeSignup()` exactly once,
 * right after a brand-new account is created — completing the funnel's signup
 * leg (click → SIGNUP → revenue) for LaunchWake's own dogfooding.
 *
 * The trigger is server-driven: `createUser` in lib/auth.ts drops a one-time,
 * client-readable `lw_signup_ping` cookie ONLY on a real new signup that carried
 * an lw_ref. We consume it here, clear it up front so a reload can't re-fire it,
 * then call `launchwakeSignup()` (which beacons the SIGNUP event through the
 * pixel — not server-side, which would double-count). The pixel script loads
 * `afterInteractive`, so we poll briefly for the global before giving up.
 */
const COOKIE = "lw_signup_ping";
const POLL_MS = 250;
const MAX_TRIES = 24; // ~6s

export function PixelSignupPing() {
  useEffect(() => {
    const hasFlag = document.cookie
      .split("; ")
      .some((c) => c.startsWith(`${COOKIE}=`));
    if (!hasFlag) return;

    // Consume the flag immediately so a refresh never double-counts the signup.
    document.cookie = `${COOKIE}=; Max-Age=0; path=/`;

    let tries = 0;
    const timer = setInterval(() => {
      const fire = (window as unknown as { launchwakeSignup?: () => void })
        .launchwakeSignup;
      if (typeof fire === "function") {
        fire();
        clearInterval(timer);
      } else if (++tries >= MAX_TRIES) {
        clearInterval(timer); // pixel blocked or never loaded — give up quietly
      }
    }, POLL_MS);

    return () => clearInterval(timer);
  }, []);

  return null;
}
