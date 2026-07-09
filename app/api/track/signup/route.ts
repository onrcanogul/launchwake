import { NextRequest, NextResponse, after } from "next/server";
import { recordSignup, sanitizeTouches, signupContext } from "@/lib/attribution";
import { isValidProjectId } from "@/lib/pixel";
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
 * Signup attribution endpoint. The product's thank-you page reports the lw_ref(s)
 * it captured from tracked-link clicks. Accepts:
 *   - GET  /api/track/signup?ref=CODE                  (1x1 pixel, legacy single ref)
 *   - POST /api/track/signup  { project, refs:[…], email? }  (fetch/sendBeacon)
 *   - the lw_ref cookie as a fallback (same-site products)
 *
 * Multi-touch: `refs` is the last-3 distinct codes (most-recent first). We
 * attribute the signup last-touch (refs[0]) and keep the rest in meta.touches.
 * With no ref but an email, we try cross-device recovery; failing that we record
 * an unattributed signup against `project` so the total still reconciles.
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

/** Optional project id from a beacon body / query — only trusted if cuid-shaped. */
function safeProject(raw: unknown): string | undefined {
  return typeof raw === "string" && isValidProjectId(raw) ? raw : undefined;
}

/**
 * Assemble the ordered touch list. Cookie-then-localStorage: the same-site lw_ref
 * cookie (if the beacon carried it) leads, then the client-sent refs. sanitizeTouches
 * validates, dedupes, and caps at the last 3.
 */
function touchesFrom(req: NextRequest, bodyRefs: unknown): string[] {
  const cookieRef = req.cookies.get("lw_ref")?.value;
  const list = Array.isArray(bodyRefs) ? bodyRefs : [];
  return sanitizeTouches([cookieRef, ...list]);
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  // Support a single ?ref (legacy pixel) or comma-separated ?refs.
  const refsParam = q.get("refs")?.split(",") ?? (q.get("ref") ? [q.get("ref")!] : []);
  const email = q.get("email");
  const projectId = safeProject(q.get("project"));

  // Over the limit — or from a crawler/prefetch — we still return the pixel
  // (never break the product page) but skip recording, so a scripted pixel-loop
  // or a link-preview fetch can't manufacture signups.
  const rl = await rateLimitDurable(`signup:${clientIp(req.headers)}`, RL_LIMIT, RL_WINDOW_MS);
  const bot = isLikelyBot(botSignalsFromHeaders(req.headers));
  if (rl.ok && !bot) {
    const outcome = await recordSignup({
      touches: touchesFrom(req, refsParam),
      email,
      projectId,
      ip: clientIp(req.headers),
      userAgent: req.headers.get("user-agent") ?? "",
      via: "pixel",
    });
    if (outcome.ok && outcome.shortCode) {
      const code = outcome.shortCode;
      after(() => trackPixelInstalled(code, "pixel"));
    }
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
  let body: { ref?: unknown; refs?: unknown; email?: unknown; project?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    /* no JSON body */
  }
  const bodyRefs = Array.isArray(body.refs) ? body.refs : body.ref ? [body.ref] : [];
  const email = typeof body.email === "string" ? body.email : null;
  const projectId = safeProject(body.project);

  const rl = await rateLimitDurable(`signup:${clientIp(req.headers)}`, RL_LIMIT, RL_WINDOW_MS);
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: "Rate limited" }, { status: 429, headers: CORS });
  }
  // Crawlers/prefetch get a benign 200 without recording.
  if (isLikelyBot(botSignalsFromHeaders(req.headers))) {
    return NextResponse.json({ ok: false }, { headers: CORS });
  }

  const outcome = await recordSignup({
    touches: touchesFrom(req, bodyRefs),
    email,
    projectId,
    ip: clientIp(req.headers),
    userAgent: req.headers.get("user-agent") ?? "",
    via: "beacon",
  });
  if (outcome.ok && outcome.shortCode) {
    const code = outcome.shortCode;
    after(() => trackPixelInstalled(code, "beacon"));
  }
  return NextResponse.json(
    { ok: outcome.ok, attributed: outcome.attributed, mode: outcome.mode },
    { headers: CORS },
  );
}
