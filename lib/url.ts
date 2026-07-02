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
