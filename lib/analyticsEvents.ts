/**
 * Activation-funnel event names, shared by server capture (lib/analytics.ts)
 * and client beacons. This module is intentionally free of env/db imports so
 * client components can import the constants without pulling server-only code
 * into the browser bundle.
 */

export const EVENTS = {
  /** Marketing landing page rendered in a browser. Anonymous. */
  landingView: "landing_view",
  /** Public login-less Launch Checker produced a plan. Anonymous. */
  launchCheckerRun: "launch_checker_run",
  /** A new user account was created (Auth.js createUser). */
  signup: "signup",
  /** The user saw their first distribution plan — the activation aha. */
  firstPlanViewed: "first_plan_viewed",
  /** A draft body was copied from the Launch kit. */
  draftCopied: "draft_copied",
  /** The user recorded a post (tracked link minted). */
  shipMarkedPosted: "ship_marked_posted",
  /** The attribution pixel proved it's live (first signup ping / verify). */
  pixelInstalled: "pixel_installed",
  /** The dark-social survey snippet went live (first self-report received). */
  surveyInstalled: "survey_installed",
} as const;

export type AnalyticsEvent = (typeof EVENTS)[keyof typeof EVENTS];

/**
 * Events a browser is allowed to report via the beacon route (/api/a). Only
 * UI-interaction moments the server can't observe belong here — everything
 * else is captured server-side where it can't be spoofed.
 */
export const CLIENT_EVENTS = [EVENTS.landingView, EVENTS.draftCopied] as const;

export type ClientAnalyticsEvent = (typeof CLIENT_EVENTS)[number];

export function isClientEvent(value: string): value is ClientAnalyticsEvent {
  return (CLIENT_EVENTS as readonly string[]).includes(value);
}
