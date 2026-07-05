import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { capture, isClientEvent } from "@/lib/analytics";
import { rateLimitDurable, clientIp } from "@/lib/ratelimit";

/**
 * Client-event beacon ("a" = analytics; the terse path dodges blanket
 * "/analytics" filter rules). Browser-only funnel moments (landing view, draft
 * copy) report here and are captured server-side — no client PostHog SDK, no
 * key in the bundle. The event allowlist (CLIENT_EVENTS) means a caller can't
 * inject server-authoritative events like `signup`.
 */

// Generous for humans clicking around; a nuisance for a spam loop.
const RL_LIMIT = 60;
const RL_WINDOW_MS = 60 * 1000;

const BodySchema = z.object({
  event: z.string().refine(isClientEvent, "Unknown event"),
  // Primitive-only, small, and few — enough for a platform label, no room for PII blobs.
  properties: z
    .record(z.string().max(40), z.union([z.string().max(120), z.number(), z.boolean()]))
    .optional()
    .refine((p) => !p || Object.keys(p).length <= 8, "Too many properties"),
});

export async function POST(req: NextRequest) {
  const rl = await rateLimitDurable(`beacon:${clientIp(req.headers)}`, RL_LIMIT, RL_WINDOW_MS);
  if (!rl.ok) return new NextResponse(null, { status: 429 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return new NextResponse(null, { status: 400 });

  // Signed-in users are identified by user id; everyone else stays anonymous.
  const session = await auth().catch(() => null);
  await capture({
    event: parsed.data.event,
    distinctId: session?.user?.id ?? undefined,
    properties: parsed.data.properties,
  });

  return new NextResponse(null, { status: 204 });
}
