import { NextRequest, NextResponse } from "next/server";
import { ingestSignup } from "@/lib/attribution";

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

export async function GET(req: NextRequest) {
  const ref =
    req.nextUrl.searchParams.get("ref") ?? req.cookies.get("lw_ref")?.value;
  if (ref) await ingestSignup(ref, { via: "pixel" });

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
  try {
    const body = (await req.json()) as { ref?: string };
    ref = body.ref;
  } catch {
    /* no JSON body */
  }
  ref = ref ?? req.cookies.get("lw_ref")?.value ?? undefined;

  const ok = ref ? await ingestSignup(ref, { via: "beacon" }) : false;
  return NextResponse.json({ ok }, { headers: CORS });
}
