import { NextRequest, NextResponse } from "next/server";
import { verifyUnsubscribeToken, setEmailNotifications } from "@/lib/emailPrefs";

/**
 * One-click unsubscribe from product-notification emails (weekly digest,
 * plan-ready). No login: the link carries an HMAC token bound to the user id.
 * GET serves a human clicking the footer link; POST serves RFC 8058
 * List-Unsubscribe=One-Click (mail clients POST with no body).
 */

function params(req: NextRequest): { userId: string; token: string } | null {
  const userId = req.nextUrl.searchParams.get("u");
  const token = req.nextUrl.searchParams.get("t");
  if (!userId || !token) return null;
  return { userId, token };
}

async function unsubscribe(req: NextRequest): Promise<boolean> {
  const p = params(req);
  if (!p || !verifyUnsubscribeToken(p.userId, p.token)) return false;
  return setEmailNotifications(p.userId, false);
}

const PAGE_STYLE = `margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center;background:#0A0B0F;color:#E7E9ED;font:450 14px/1.65 Inter,system-ui,sans-serif`;

function page(title: string, body: string): NextResponse {
  return new NextResponse(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="robots" content="noindex"><title>${title} — LaunchWake</title></head><body style="${PAGE_STYLE}"><div style="max-width:420px;padding:32px;border:1px solid rgba(255,255,255,.07);border-radius:10px;background:#0D0F14"><h1 style="font-size:16px;font-weight:600;margin:0 0 8px">${title}</h1><p style="color:#9CA3B0;margin:0">${body}</p></div></body></html>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

export async function GET(req: NextRequest) {
  const ok = await unsubscribe(req);
  return ok
    ? page(
        "You're unsubscribed",
        "No more digest or notification emails. You can turn them back on any time in Settings → Emails.",
      )
    : page(
        "That link didn't work",
        "It may be old or incomplete. You can manage emails from Settings inside LaunchWake.",
      );
}

export async function POST(req: NextRequest) {
  const ok = await unsubscribe(req);
  return NextResponse.json({ ok }, { status: ok ? 200 : 400 });
}
