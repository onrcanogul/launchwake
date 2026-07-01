import { NextRequest, NextResponse } from "next/server";
import { ingestClick } from "@/lib/attribution";
import { env } from "@/lib/env";

/**
 * Tracked-link redirect. Logs a CLICK, drops a first-party lw_ref cookie (in case
 * the product is same-site), and 302s to the product URL with ?lw_ref appended.
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ code: string }> },
) {
  const { code } = await ctx.params;
  const dest = await ingestClick(code);

  if (!dest) {
    return NextResponse.redirect(new URL("/", env.APP_URL));
  }

  const res = NextResponse.redirect(dest);
  res.cookies.set("lw_ref", code, {
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
    sameSite: "lax",
  });
  return res;
}
