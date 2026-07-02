import { NextResponse } from "next/server";
import { LeadInputSchema, captureLead } from "@/lib/leads";
import { rateLimit, clientIp } from "@/lib/ratelimit";

/**
 * Public lead capture for the lead-magnet tools. POST { email, source, ... }.
 * Stores the lead; the full plan stays gated behind signup (handled in the UI).
 * IP rate-limited to blunt junk submissions.
 */

const LIMIT = 5;
const WINDOW_MS = 10 * 60 * 1000;

export async function POST(req: Request) {
  const ip = clientIp(req.headers);
  const rl = rateLimit(`lead:${ip}`, LIMIT, WINDOW_MS);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many submissions — try again shortly." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = LeadInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  try {
    await captureLead(parsed.data);
  } catch {
    return NextResponse.json({ error: "Couldn't save that — try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
