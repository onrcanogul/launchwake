/**
 * The LaunchWake attribution pixel — served as a tiny hosted script so setup is
 * a copy-paste one-liner instead of a pasted inline block. The script:
 *
 *   1. captures `lw_ref` from tracked-link clicks into BOTH a first-party cookie
 *      (90d, SameSite=Lax) and localStorage (90d), keeping the last 3 distinct
 *      codes for multi-touch — two carriers survive more than one,
 *   2. defines `window.launchwakeSignup(email)` for the signup-success page —
 *      reads cookie-then-localStorage and always reports (so signups with no
 *      tracked link still reconcile as dark social),
 *   3. sends a throttled verification ping so LaunchWake can show a
 *      "pixel detected" state (the biggest drop-off in tracking setup was
 *      never knowing whether the snippet actually went live).
 *
 * It only reads a query param + its own lw_ref cookie/localStorage and reports
 * back to LaunchWake — it never injects into the host page's DOM.
 *
 * This module is pure (no db/env imports) so client components can render the
 * snippets; the ping-recording db side lives in lib/attribution.ts.
 */

import { SELF_REPORT_OPTIONS } from "./selfReport";

/**
 * Single source of truth for the signup endpoint path, shared by the served pixel
 * (browser) and the backend fetch one-liner (server) so the two can't drift.
 */
export const SIGNUP_PATH = "/api/track/signup";

/** How many distinct lw_ref touches the snippet keeps for multi-touch (last-N). */
export const MAX_TOUCHES = 3;

/** localStorage/cookie persistence window for a captured lw_ref (90 days). */
export const REF_TTL_MS = 90 * 24 * 60 * 60 * 1000;

/** cuid/cuid2-shaped ids only — the pixel route interpolates this into JS. */
export function isValidProjectId(id: string): boolean {
  return /^[a-z0-9]{20,32}$/.test(id);
}

function baseUrl(appUrl: string): string {
  return appUrl.replace(/\/$/, "");
}

/** The hosted script URL for a project. */
export function pixelSrc(appUrl: string, projectId: string): string {
  return `${baseUrl(appUrl)}/api/pixel/${projectId}`;
}

/** The one-liner the user pastes site-wide. */
export function pixelScriptTag(appUrl: string, projectId: string): string {
  return `<script async src="${pixelSrc(appUrl, projectId)}"></script>`;
}

/** Snippet for a Next.js (App Router) root layout. */
export function pixelNextjsSnippet(appUrl: string, projectId: string): string {
  return `// app/layout.tsx
import Script from "next/script";

// …inside <body>, next to {children}:
<Script src="${pixelSrc(appUrl, projectId)}" strategy="afterInteractive" />`;
}

/** Snippet for a plain HTML site. */
export function pixelHtmlSnippet(appUrl: string, projectId: string): string {
  return `<!-- before </head>, on every page -->
${pixelScriptTag(appUrl, projectId)}`;
}

/** Verification pings are throttled per browser to one per this window. */
export const PIXEL_PING_THROTTLE_MS = 24 * 60 * 60 * 1000;

/**
 * The JavaScript body served by /api/pixel/[projectId]. Pure string builder so
 * the behavior is unit-testable without a browser.
 */
export function buildPixelJs(appUrl: string, projectId: string): string {
  const base = baseUrl(appUrl);
  // projectId is validated by the route (isValidProjectId) before it's
  // interpolated, so it can't break out of the string literal.
  return `(function () {
  // LaunchWake attribution pixel — https://launchwake.com
  var BASE = ${JSON.stringify(base)};
  var PROJECT = ${JSON.stringify(projectId)};
  var STORE = 'lw_ref';                 // localStorage key + cookie name
  var MAX_TOUCHES = ${MAX_TOUCHES};     // keep the last N distinct codes (multi-touch)
  var TTL = ${REF_TTL_MS};              // 90-day localStorage expiry (ms)
  var CODE = /^[0-9A-Za-z]{1,64}$/;     // a tracked-link short code
  function beacon(path, body) {
    try {
      navigator.sendBeacon(BASE + path, new Blob([JSON.stringify(body)], { type: 'application/json' }));
    } catch (e) {}
  }
  // Read the stored touch list from localStorage, honoring the 90-day expiry.
  function readTouches() {
    try {
      var raw = localStorage.getItem(STORE);
      if (!raw) return [];
      var o = JSON.parse(raw);
      if (!o || !(o.e > Date.now()) || !o.t || !o.t.length) return [];
      return o.t.filter(function (x) { return typeof x === 'string' && CODE.test(x); }).slice(0, MAX_TOUCHES);
    } catch (e) { return []; }
  }
  function writeTouches(list) {
    try { localStorage.setItem(STORE, JSON.stringify({ t: list.slice(0, MAX_TOUCHES), e: Date.now() + TTL })); } catch (e) {}
  }
  // Prepend a code (most-recent first), drop an earlier duplicate, cap at MAX_TOUCHES.
  function merge(list, code) {
    var out = [code];
    for (var i = 0; i < list.length && out.length < MAX_TOUCHES; i++) {
      if (list[i] !== code) out.push(list[i]);
    }
    return out;
  }
  function cookieRef() {
    try {
      var m = (document.cookie || '').match(/(?:^|; )lw_ref=([^;]+)/);
      var v = m ? decodeURIComponent(m[1]) : null;
      return v && CODE.test(v) ? v : null;
    } catch (e) { return null; }
  }
  // 1. Capture lw_ref from a tracked-link click (any page). Mirror it into a
  //    first-party cookie (90d, SameSite=Lax) AND the localStorage touch list.
  try {
    var ref = new URLSearchParams(location.search).get('lw_ref');
    if (ref && CODE.test(ref)) {
      writeTouches(merge(readTouches(), ref));
      try { document.cookie = STORE + '=' + ref + '; max-age=' + (TTL / 1000) + '; path=/; SameSite=Lax'; } catch (e) {}
    }
  } catch (e) {}
  // 2. Call launchwakeSignup(email) on your signup-success page. Reads
  //    cookie-then-localStorage and ALWAYS reports (even with no ref) so signups
  //    with no tracked link still reconcile as dark social. Email is optional and
  //    hashed on our server for dedup + cross-device recovery — never stored raw.
  window.launchwakeSignup = function (email) {
    var list = readTouches();
    var c = cookieRef();
    if (c) list = merge(list, c);
    beacon(${JSON.stringify(SIGNUP_PATH)}, { project: PROJECT, refs: list, email: email || undefined });
  };
  // 2b. Call launchwakeSurvey(answer) with the visitor's "how did you hear
  //     about us?" answer. This is the only signal that catches dark social —
  //     the podcast/DM/word-of-mouth that a link or UTM can never see. The most
  //     recent lw_ref goes too, so LaunchWake can flag when the link disagrees
  //     with what the human said.
  window.launchwakeSurvey = function (answer) {
    if (!answer) return;
    var list = readTouches();
    beacon('/api/track/survey', { project: PROJECT, answer: String(answer), ref: list[0] || null });
  };
  // 3. Verification ping (throttled per browser) so LaunchWake can show
  //    "pixel detected". Skipped when localStorage is unavailable.
  try {
    var key = 'lw_pixel_ping';
    var last = Number(localStorage.getItem(key) || 0);
    if (Date.now() - last > ${PIXEL_PING_THROTTLE_MS}) {
      localStorage.setItem(key, String(Date.now()));
      beacon('/api/track/verify', { project: PROJECT });
    }
  } catch (e) {}
})();
`;
}

/**
 * Backend (no-SDK) signup report — the npm-free counterpart to the browser pixel,
 * for frameworks that record signups server-side. Built from the same `SIGNUP_PATH`
 * as the pixel so the two never drift. Pass the `lw_ref` you stored at signup.
 */
export function pixelBackendSnippet(appUrl: string, projectId: string): string {
  const base = baseUrl(appUrl);
  return `// Backend / server-side (any language — this is just fetch, no SDK).
// Report a signup with the lw_ref you stored for this user at click time.
await fetch(${JSON.stringify(base + SIGNUP_PATH)}, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    project: ${JSON.stringify(projectId)},
    ref: lwRef,           // the lw_ref you captured/stored for this user
    email: userEmail      // optional — hashed server-side for cross-device recovery
  })
});`;
}

// ── Self-report survey snippet (dark-social attribution) ───────────────────
// The pixel above defines window.launchwakeSurvey(answer); these builders give
// the user a turnkey "how did you hear about us?" field to wire it to. The
// option set is the shared taxonomy (lib/selfReport.ts) so both funnels — the
// customer's and LaunchWake's own — normalize into the same sources.

/** The <option> rows for the drop-in select, from the shared taxonomy. */
export function surveyOptionsHtml(): string {
  return SELF_REPORT_OPTIONS.filter((o) => o.value !== "other")
    .map((o) => `    <option value="${o.value}">${o.label}</option>`)
    .join("\n");
}

/** The one-liner the user calls once the answer is chosen / signup succeeds. */
export function surveyCallSnippet(): string {
  return `// Once the visitor picks an answer (or on signup success), report it:
window.launchwakeSurvey(document.getElementById('lw-heard').value);`;
}

/**
 * A complete drop-in "how did you hear about us?" field for a signup form. It
 * only needs the pixel (which defines launchwakeSurvey) already on the page.
 */
export function surveyDropInSnippet(): string {
  return `<!-- On your signup form. Needs the LaunchWake pixel on the page. -->
<label for="lw-heard">How did you hear about us?</label>
<select id="lw-heard" onchange="window.launchwakeSurvey(this.value)">
    <option value="" disabled selected>Choose one…</option>
${surveyOptionsHtml()}
    <option value="other">Something else</option>
</select>`;
}

/** Snippet for a React/Next.js signup form (controlled select). */
export function surveyReactSnippet(): string {
  return `// In your signup form. Needs the LaunchWake pixel in the app.
<label htmlFor="lw-heard">How did you hear about us?</label>
<select
  id="lw-heard"
  defaultValue=""
  onChange={(e) => window.launchwakeSurvey?.(e.target.value)}
>
  <option value="" disabled>Choose one…</option>
${SELF_REPORT_OPTIONS.map((o) => `  <option value="${o.value}">${o.label}</option>`).join("\n")}
</select>`;
}

/** AI-assistant prompt that sets the same thing up, stack-agnostic. */
export function surveyPromptSnippet(): string {
  return `Add a "How did you hear about us?" question to my signup flow and report the answer to LaunchWake. Detect my framework and fit the integration to how my signup form already works — the example is illustrative.

1. On the signup form, add a required-ish dropdown with these options (value → label):
${SELF_REPORT_OPTIONS.map((o) => `   - ${o.value} → ${o.label}`).join("\n")}
2. The LaunchWake pixel (already installed site-wide) exposes a global \`window.launchwakeSurvey(answer)\`. Call it with the selected value once the signup succeeds (or on change).

This captures dark-social attribution — the podcast, DM, or word-of-mouth that a tracked link or UTM can never see — and reconciles it against any link click LaunchWake already recorded.`;
}
