import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { isValidProjectId } from "@/lib/pixel";
import { recordPixelPing } from "@/lib/attribution";
import { rateLimitDurable, clientIp } from "@/lib/ratelimit";
import { isLikelyBot, botSignalsFromHeaders } from "@/lib/botDetection";
import { captureUser, EVENTS } from "@/lib/analytics";

/**
 * Pixel verification ping. The hosted pixel beacons here (throttled per
 * browser) so Results/Settings can show a "pixel detected" state instead of
 * leaving the user to guess whether their snippet went live. CORS-open — it's
 * called from the product's own domain.
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// The pixel throttles itself to ~1/day per browser; this cap only blunts abuse.
const RL_LIMIT = 30;
const RL_WINDOW_MS = 60 * 1000;

const BodySchema = z.object({
  project: z.string().refine(isValidProjectId, "Invalid project id"),
});

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: NextRequest) {
  const rl = await rateLimitDurable(`verify:${clientIp(req.headers)}`, RL_LIMIT, RL_WINDOW_MS);
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: "Rate limited" }, { status: 429, headers: CORS });
  }
  // A crawler/prefetch that happens to execute the pixel shouldn't flip the
  // "pixel detected" state — acknowledge without recording.
  if (isLikelyBot(botSignalsFromHeaders(req.headers))) {
    return NextResponse.json({ ok: false }, { headers: CORS });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400, headers: CORS });
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false }, { status: 400, headers: CORS });
  }

  const res = await recordPixelPing(parsed.data.project);
  // Funnel: the very first ping is the "pixel installed" activation moment.
  if (res.ok && res.first && res.accountId) {
    const accountId = res.accountId;
    after(() => captureUser(accountId, EVENTS.pixelInstalled, { via: "verify" }));
  }

  return NextResponse.json({ ok: res.ok }, { headers: CORS });
}
