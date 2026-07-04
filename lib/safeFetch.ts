import { lookup as dnsLookup } from "node:dns/promises";
import { BlockList, isIPv4, isIPv6 } from "node:net";

/**
 * SSRF-safe fetch for user-supplied URLs.
 *
 * The upcoming readiness-score / site-audit feature will fetch arbitrary URLs a
 * user typed (their landing page, a competitor, a docs link). A naive `fetch`
 * there is a Server-Side Request Forgery hole: the URL could point at the cloud
 * metadata endpoint (169.254.169.254), an internal admin panel (10.x/192.168.x),
 * localhost, or use a redirect / DNS rebinding to slip past a shallow check.
 *
 * `safeFetchPublicUrl` closes that hole:
 *   (a) allows only http/https,
 *   (b) resolves DNS first and rejects any private/reserved address the host
 *       resolves to (so a "public" hostname that maps to 127.0.0.1 is refused),
 *   (c) follows at most 3 redirects, re-validating the host on every hop,
 *   (d) enforces a 5s timeout and a 2MB response cap (streamed, not trusted from
 *       Content-Length),
 *   (e) always sends a fixed `LaunchWakeBot/1.0` user-agent.
 *
 * Usage (Launch Mode readiness / site audit):
 *
 * ```ts
 * import { safeFetchPublicUrl, SafeFetchError } from "@/lib/safeFetch";
 *
 * try {
 *   const res = await safeFetchPublicUrl(project.url, { maxBytes: 1_000_000 });
 *   const html = res.text();
 *   // …parse title, meta description, detect a signup form, etc.
 * } catch (err) {
 *   if (err instanceof SafeFetchError) {
 *     // Blocked/unreachable/oversized — surface a friendly "couldn't reach it".
 *   } else {
 *     throw err;
 *   }
 * }
 * ```
 *
 * NOTE: not wired into any feature yet — import it wherever a user URL is fetched
 * server-side. Never fetch a user URL with the bare global `fetch`.
 */

const USER_AGENT = "LaunchWakeBot/1.0";
const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_MAX_BYTES = 2 * 1024 * 1024; // 2MB
const DEFAULT_MAX_REDIRECTS = 3;

/** Thrown for any policy rejection (blocked host, bad scheme, too big, timeout). */
export class SafeFetchError extends Error {}

// Private / reserved ranges we refuse to connect to. BlockList handles the CIDR
// math (and IPv4-mapped IPv6) natively, so we don't hand-roll address parsing.
const BLOCKED = new BlockList();
BLOCKED.addSubnet("0.0.0.0", 8, "ipv4"); // "this" network
BLOCKED.addSubnet("10.0.0.0", 8, "ipv4"); // private
BLOCKED.addSubnet("127.0.0.0", 8, "ipv4"); // loopback
BLOCKED.addSubnet("169.254.0.0", 16, "ipv4"); // link-local (cloud metadata)
BLOCKED.addSubnet("172.16.0.0", 12, "ipv4"); // private
BLOCKED.addSubnet("192.168.0.0", 16, "ipv4"); // private
BLOCKED.addAddress("::1", "ipv6"); // loopback
BLOCKED.addSubnet("fc00::", 7, "ipv6"); // unique-local
BLOCKED.addSubnet("fe80::", 10, "ipv6"); // link-local

/** One resolved address, matching Node's dns `LookupAddress` shape. */
export type ResolvedAddress = { address: string; family: number };

export type SafeFetchOptions = {
  method?: string;
  /** Extra request headers. `user-agent` is always forced to LaunchWakeBot/1.0. */
  headers?: Record<string, string>;
  /** Max redirects to follow, each re-validated. Default 3. */
  maxRedirects?: number;
  /** Overall timeout across all hops, in ms. Default 5000. */
  timeoutMs?: number;
  /** Max response body bytes before aborting. Default 2MB. */
  maxBytes?: number;
  /** Injectable DNS resolver (tests). Defaults to node:dns lookup(all). */
  lookup?: (hostname: string) => Promise<ResolvedAddress[]>;
  /** Injectable fetch (tests). Defaults to global fetch. */
  fetchImpl?: typeof fetch;
};

export type SafeFetchResult = {
  /** Final URL after any redirects. */
  url: string;
  status: number;
  headers: Headers;
  /** Body bytes, already capped at maxBytes. */
  bytes: Uint8Array;
  /** Decode the body as UTF-8 text. */
  text(): string;
};

const REDIRECT_STATUS = new Set([301, 302, 303, 307, 308]);

/** True if `address` is a private/reserved IP we must not connect to. */
function isBlockedAddress(address: string): boolean {
  // Normalize an IPv4-mapped IPv6 ("::ffff:10.0.0.1") to its IPv4 form so the
  // IPv4 subnets match.
  const mapped = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i.exec(address);
  const addr = mapped ? mapped[1] : address;
  if (isIPv4(addr)) return BLOCKED.check(addr, "ipv4");
  if (isIPv6(addr)) return BLOCKED.check(addr, "ipv6");
  // Not a parseable IP → refuse rather than risk it.
  return true;
}

/** Parse `raw` and require an http/https scheme. */
function parseHttpUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new SafeFetchError(`Invalid URL: ${raw}`);
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new SafeFetchError(`Only http(s) URLs are allowed (got ${u.protocol}).`);
  }
  return u;
}

/**
 * Reject the host unless every address it resolves to is public. Resolving ALL
 * addresses and refusing if ANY is private defeats a rebinding record that mixes
 * a public and a private answer.
 */
async function assertPublicHost(
  hostname: string,
  lookup: (hostname: string) => Promise<ResolvedAddress[]>,
): Promise<void> {
  // Strip brackets from an IPv6 literal host ("[::1]").
  const literal = hostname.replace(/^\[|\]$/g, "");
  if (isIPv4(literal) || isIPv6(literal)) {
    if (isBlockedAddress(literal)) {
      throw new SafeFetchError(`Refusing to connect to private address ${literal}.`);
    }
    return;
  }

  const results = await lookup(hostname);
  if (!results || results.length === 0) {
    throw new SafeFetchError(`Could not resolve ${hostname}.`);
  }
  for (const r of results) {
    if (isBlockedAddress(r.address)) {
      throw new SafeFetchError(
        `${hostname} resolves to a private address (${r.address}).`,
      );
    }
  }
}

/** Read the body, aborting past `maxBytes` — never trust Content-Length alone. */
async function readCapped(res: Response, maxBytes: number): Promise<Uint8Array> {
  const declared = Number(res.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new SafeFetchError(`Response too large (${declared} bytes > ${maxBytes}).`);
  }
  const reader = res.body?.getReader();
  if (!reader) return new Uint8Array(0);

  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new SafeFetchError(`Response exceeded ${maxBytes} bytes.`);
    }
    chunks.push(value);
  }

  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

/**
 * Fetch a user-supplied public URL with SSRF protection. See the file header for
 * the full policy. Throws `SafeFetchError` on any policy rejection.
 */
export async function safeFetchPublicUrl(
  rawUrl: string,
  opts: SafeFetchOptions = {},
): Promise<SafeFetchResult> {
  const maxRedirects = opts.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;
  const lookup = opts.lookup ?? ((h: string) => dnsLookup(h, { all: true }));
  const doFetch = opts.fetchImpl ?? fetch;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let currentUrl = rawUrl;
    for (let hop = 0; hop <= maxRedirects; hop++) {
      const u = parseHttpUrl(currentUrl);
      await assertPublicHost(u.hostname, lookup);

      const res = await doFetch(u.href, {
        method: opts.method ?? "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: { ...(opts.headers ?? {}), "user-agent": USER_AGENT },
      });

      const location = res.headers.get("location");
      if (REDIRECT_STATUS.has(res.status) && location) {
        if (hop === maxRedirects) {
          throw new SafeFetchError(`Too many redirects (>${maxRedirects}).`);
        }
        // Resolve relative Locations against the current URL; the next loop
        // re-validates scheme + host before connecting.
        currentUrl = new URL(location, u.href).href;
        await res.body?.cancel().catch(() => {});
        continue;
      }

      const bytes = await readCapped(res, maxBytes);
      return {
        url: u.href,
        status: res.status,
        headers: res.headers,
        bytes,
        text: () => new TextDecoder().decode(bytes),
      };
    }
    throw new SafeFetchError(`Too many redirects (>${maxRedirects}).`);
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new SafeFetchError(`Request timed out after ${timeoutMs}ms.`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
