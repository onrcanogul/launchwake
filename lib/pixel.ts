/**
 * The LaunchWake attribution pixel — served as a tiny hosted script so setup is
 * a copy-paste one-liner instead of a pasted inline block. The script:
 *
 *   1. captures `lw_ref` from tracked-link clicks into localStorage,
 *   2. defines `window.launchwakeSignup()` for the signup-success page,
 *   3. sends a throttled verification ping so LaunchWake can show a
 *      "pixel detected" state (the biggest drop-off in tracking setup was
 *      never knowing whether the snippet actually went live).
 *
 * It only ever reads a query param and reports back to LaunchWake — it never
 * touches the host page's DOM or cookies.
 *
 * This module is pure (no db/env imports) so client components can render the
 * snippets; the ping-recording db side lives in lib/attribution.ts.
 */

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
  function beacon(path, body) {
    try {
      navigator.sendBeacon(BASE + path, new Blob([JSON.stringify(body)], { type: 'application/json' }));
    } catch (e) {}
  }
  // 1. Capture lw_ref from a tracked-link click (any page).
  try {
    var ref = new URLSearchParams(location.search).get('lw_ref');
    if (ref) localStorage.setItem('lw_ref', ref);
  } catch (e) {}
  // 2. Call launchwakeSignup() on your signup-success page.
  window.launchwakeSignup = function () {
    var r; try { r = localStorage.getItem('lw_ref'); } catch (e) {}
    if (r) beacon('/api/track/signup', { ref: r });
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
