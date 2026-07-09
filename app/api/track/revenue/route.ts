import { NextRequest, NextResponse } from "next/server";
import { ingestRevenue } from "@/lib/attribution";
import { rateLimitDurable, clientIp } from "@/lib/ratelimit";
import { isLikelyBot, botSignalsFromHeaders } from "@/lib/botDetection";

/**
 * Generic revenue attribution endpoint — provider-agnostic. Forward a payment
 * from anywhere (your Stripe webhook handler, a PostHog action, GA4, or your own
 * backend) with the lw_ref you captured at signup:
 *
 *   POST /api/track/revenue  { ref, amountCents, currency?, recurring? }
 *   POST /api/track/revenue  { ref, amount: 49.00, currency: "usd" }   // major units
 *   GET  /api/track/revenue?ref=CODE&amount=49&currency=usd&recurring=1
 *
 * CORS-open like the signup pixel. Amounts are client-supplied, so they're only
 * TRUSTED (Event.verified=true) when the request carries a valid `x-lw-signature`
 * (HMAC-SHA256 of the raw body, keyed by the project's webhookSecret). Unsigned
 * calls are still recorded — as verified=false — and Results sums them separately.
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-LW-Signature",
};

const LIMIT = 60;
const WINDOW_MS = 60 * 1000;

function toCents(body: { amountCents?: unknown; amount?: unknown }): number | null {
  if (body.amountCents !== undefined && body.amountCents !== null) {
    const n = Number(body.amountCents);
    return Number.isFinite(n) ? Math.round(n) : null;
  }
  if (body.amount !== undefined && body.amount !== null) {
    const n = Number(body.amount);
    return Number.isFinite(n) ? Math.round(n * 100) : null;
  }
  return null;
}

function truthy(v: unknown): boolean {
  return v === true || v === "1" || v === "true" || v === 1;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

async function handle(
  ref: string | undefined,
  amountCents: number | null,
  currency: string | undefined,
  recurring: boolean,
  hmac: { rawBody: string; signature: string | null },
) {
  if (!ref || amountCents === null || amountCents <= 0) {
    return NextResponse.json(
      { ok: false, error: "Provide ref and a positive amount." },
      { status: 400, headers: CORS },
    );
  }
  // Stays GLOBAL (public call carries only the code — no projectId enforcement).
  // `hmac` lets ingestRevenue mark the amount trusted iff it's signed with the
  // owning project's webhookSecret; otherwise it's recorded as verified=false.
  const ok = await ingestRevenue(
    ref,
    { amountCents, currency, recurring, meta: { via: "revenue-api" } },
    undefined,
    { hmac },
  );
  return NextResponse.json({ ok }, { headers: CORS });
}

export async function POST(req: NextRequest) {
  const rl = await rateLimitDurable(`revenue:${clientIp(req.headers)}`, LIMIT, WINDOW_MS);
  if (!rl.ok) return NextResponse.json({ ok: false, error: "Rate limited" }, { status: 429, headers: CORS });
  if (isLikelyBot(botSignalsFromHeaders(req.headers))) {
    return NextResponse.json({ ok: false }, { headers: CORS });
  }

  // Read the RAW body (not req.json) so the HMAC is checked against the exact bytes.
  const rawBody = await req.text();
  let body: { ref?: string; amount?: unknown; amountCents?: unknown; currency?: string; recurring?: unknown } = {};
  try {
    body = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    /* empty / non-JSON body */
  }
  const ref = body.ref ?? req.cookies.get("lw_ref")?.value ?? undefined;
  return handle(ref, toCents(body), body.currency, truthy(body.recurring), {
    rawBody,
    signature: req.headers.get("x-lw-signature"),
  });
}

export async function GET(req: NextRequest) {
  const rl = await rateLimitDurable(`revenue:${clientIp(req.headers)}`, LIMIT, WINDOW_MS);
  if (!rl.ok) return NextResponse.json({ ok: false, error: "Rate limited" }, { status: 429, headers: CORS });
  if (isLikelyBot(botSignalsFromHeaders(req.headers))) {
    return NextResponse.json({ ok: false }, { headers: CORS });
  }

  const q = req.nextUrl.searchParams;
  const ref = q.get("ref") ?? req.cookies.get("lw_ref")?.value ?? undefined;
  // A GET has no signable body, so it can never be trusted — recorded verified=false.
  return handle(
    ref,
    toCents({ amount: q.get("amount"), amountCents: q.get("amountCents") }),
    q.get("currency") ?? undefined,
    truthy(q.get("recurring")),
    { rawBody: "", signature: null },
  );
}
