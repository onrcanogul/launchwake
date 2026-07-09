import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { isValidProjectId } from "@/lib/pixel";
import { recordSelfReport } from "@/lib/attribution";
import { MAX_ANSWER_LEN } from "@/lib/selfReport";
import { rateLimitDurable, clientIp } from "@/lib/ratelimit";
import { captureUser, EVENTS } from "@/lib/analytics";

/**
 * Self-report ("how did you hear about us?") ingest. The hosted pixel's
 * window.launchwakeSurvey(answer) beacons here with the visitor's answer and the
 * lw_ref it stored, if any. This is the dark-social capture: unlike the signup
 * pixel it is NOT tied to a tracked link — a self-report exists with or without
 * a prior click. CORS-open so it can be called from the product's own domain.
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Open + CORS-wide, so cap per IP to blunt junk submissions.
const RL_LIMIT = 30;
const RL_WINDOW_MS = 60 * 1000;

const BodySchema = z.object({
  project: z.string().refine(isValidProjectId, "Invalid project id"),
  answer: z.string().trim().min(1).max(MAX_ANSWER_LEN),
  ref: z.string().trim().max(64).nullish(),
});

/**
 * The first self-report proves the survey snippet is live on the customer's
 * signup form — fire `survey_installed` once (per project, effectively).
 */
async function trackSurveyInstalled(accountId: string): Promise<void> {
  await captureUser(accountId, EVENTS.surveyInstalled, {});
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: NextRequest) {
  const rl = await rateLimitDurable(`survey:${clientIp(req.headers)}`, RL_LIMIT, RL_WINDOW_MS);
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: "Rate limited" }, { status: 429, headers: CORS });
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

  const res = await recordSelfReport(parsed.data.project, {
    answer: parsed.data.answer,
    // Fall back to the same-site lw_ref cookie when the beacon body omitted it.
    lwRef: parsed.data.ref ?? req.cookies.get("lw_ref")?.value ?? null,
  });
  if (res.ok && res.first && res.accountId) {
    const accountId = res.accountId;
    after(() => trackSurveyInstalled(accountId));
  }

  return NextResponse.json({ ok: res.ok }, { headers: CORS });
}
