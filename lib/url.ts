/**
 * URL safety helpers for the tracked-link redirector.
 *
 * A shortlink that 302s to an arbitrary stored string is an open-redirect (and,
 * with `javascript:`/`data:` schemes, an XSS vector). We only ever redirect to a
 * user's own product URL, so the destination must be a real http(s) URL — this
 * gate enforces that at both write time (link creation) and read time (redirect).
 */

/** True only for a parseable absolute http:// or https:// URL. */
export function isSafeHttpUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  // A scheme with no host (e.g. "http:foo") is not a real destination.
  return u.hostname.length > 0;
}

/** A product URL longer than this is junk (or an attack) — reject it. */
export const MAX_URL_LENGTH = 500;

// Matches a leading "scheme:" (RFC 3986 scheme chars) so we can tell "myapp.com"
// (no scheme → prepend https) apart from "javascript:…" / "https://…" (has one).
const HAS_SCHEME = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

/**
 * Normalize user-entered product URLs for storage.
 *
 * Onboarding must not fail on a bare domain: `z.string().url()` rejects
 * "myapp.com", which is exactly what a founder types. This accepts that, plus
 * "www.myapp.com/x" and "https://myapp.com", and returns ONE canonical https(?)
 * href — or `null` when the input isn't a real web address.
 *
 * Rules: trim; prepend "https://" when there is no scheme; parse with `new URL`;
 * reject any non-http(s) scheme (`javascript:`, `data:`, `ftp:`, `mailto:` …);
 * reject a hostname with no dot (single-label hosts like "localhost"); drop the
 * implicit root "/" so we don't store a surprise trailing slash; reject a result
 * longer than MAX_URL_LENGTH. Pure — safe to reuse in zod transforms on client or
 * server.
 */
export function normalizeHttpUrl(input: string): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  const withScheme = HAS_SCHEME.test(trimmed) ? trimmed : `https://${trimmed}`;

  let u: URL;
  try {
    u = new URL(withScheme);
  } catch {
    return null;
  }

  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  // A real product lives on a dotted domain; single-label hosts ("localhost",
  // "intranet") aren't valid public destinations for our purposes.
  if (!u.hostname.includes(".")) return null;

  let href = u.href;
  // Canonicalize the root: "https://myapp.com/" → "https://myapp.com" so we
  // don't hand back a trailing slash the user never typed.
  if (u.pathname === "/" && !u.search && !u.hash && href.endsWith("/")) {
    href = href.slice(0, -1);
  }

  // Cap after normalization — prepending "https://" can push a long bare domain
  // over the limit even when the raw input was under it.
  if (href.length > MAX_URL_LENGTH) return null;
  return href;
}
