import { NextRequest, NextResponse, after } from "next/server";
import { ingestSignup, signupContext, signupDedupeKey } from "@/lib/attribution";
import { rateLimitDurable, clientIp } from "@/lib/ratelimit";
import { isLikelyBot, botSignalsFromHeaders } from "@/lib/botDetection";
import { captureUser, EVENTS } from "@/lib/analytics";

/**
 * Funnel: the account's first tracked signup proves the pixel is installed and
 * working — fire `pixel_installed` exactly once (per account, effectively).
 */
async function trackPixelInstalled(shortCode: string, via: string): Promise<void> {
  const ctx = await signupContext(shortCode).catch(() => null);
  if (ctx?.firstSignup) {
    await captureUser(ctx.accountId, EVENTS.pixelInstalled, { via });
  }
}

// Signup ingest is open + CORS-wide, so cap it per IP to blunt fake-signup spam.
const RL_LIMIT = 30;
const RL_WINDOW_MS = 60 * 1000;

/**
 * Signup attribution endpoint. The product's thank-you page reports the lw_ref it
 * captured from the tracked-link click. Accepts:
 *   - GET  /api/track/signup?ref=CODE        (1x1 pixel)
 *   - POST /api/track/signup  {ref:CODE}     (fetch/sendBeacon)
 *   - the lw_ref cookie as a fallback (same-site products)
 * CORS-open so it can be called from the product's own domain.
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Transparent 1x1 GIF.
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/** Idempotency key for this signup: email-based when provided, else ip+UA+link+day. */
function dedupeKeyFor(req: NextRequest, ref: string, email: string | null): string {
  return signupDedupeKey({
    ip: clientIp(req.headers),
    userAgent: req.headers.get("user-agent") ?? "",
    shortCode: ref,
    email,
  });
}

export async function GET(req: NextRequest) {
  const ref =
    req.nextUrl.searchParams.get("ref") ?? req.cookies.get("lw_ref")?.value;
  const email = req.nextUrl.searchParams.get("email");
  // Over the limit — or from a crawler/prefetch — we still return the pixel
  // (never break the product page) but skip recording, so a scripted pixel-loop
  // or a link-preview fetch can't manufacture signups.
  const rl = await rateLimitDurable(`signup:${clientIp(req.headers)}`, RL_LIMIT, RL_WINDOW_MS);
  const bot = isLikelyBot(botSignalsFromHeaders(req.headers));
  if (ref && rl.ok && !bot) {
    const ok = await ingestSignup(ref, { via: "pixel" }, { dedupeKey: dedupeKeyFor(req, ref, email) });
    if (ok) after(() => trackPixelInstalled(ref, "pixel"));
  }

  return new NextResponse(PIXEL, {
    status: 200,
    headers: {
      ...CORS,
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

export async function POST(req: NextRequest) {
  let ref: string | undefined;
  let email: string | null = null;
  try {
    const body = (await req.json()) as { ref?: string; email?: string };
    ref = body.ref;
    email = typeof body.email === "string" ? body.email : null;
  } catch {
    /* no JSON body */
  }
  ref = ref ?? req.cookies.get("lw_ref")?.value ?? undefined;

  const rl = await rateLimitDurable(`signup:${clientIp(req.headers)}`, RL_LIMIT, RL_WINDOW_MS);
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: "Rate limited" }, { status: 429, headers: CORS });
  }
  // Crawlers/prefetch get a benign 200 without recording.
  if (isLikelyBot(botSignalsFromHeaders(req.headers))) {
    return NextResponse.json({ ok: false }, { headers: CORS });
  }

  const ok = ref
    ? await ingestSignup(ref, { via: "beacon" }, { dedupeKey: dedupeKeyFor(req, ref, email) })
    : false;
  if (ok && ref) {
    const code = ref;
    after(() => trackPixelInstalled(code, "beacon"));
  }
  return NextResponse.json({ ok }, { headers: CORS });
}
