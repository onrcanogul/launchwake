import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { rollupBenchmarks } from "@/lib/benchmarks";

/**
 * Category benchmarks cron. Recomputes per-(category, channel) benchmarks from
 * first-party outcomes and refreshes the public-engagement bootstrap (median
 * upvotes from HN/Reddit) — the network part we keep off the plan-building path.
 * Run daily. Auth: "Authorization: Bearer <CRON_SECRET>" or "?secret=<CRON_SECRET>".
 */
async function handle(req: NextRequest) {
  if (env.CRON_SECRET) {
    const auth = req.headers.get("authorization");
    const bearer = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
    const secret = bearer ?? req.nextUrl.searchParams.get("secret");
    if (secret !== env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else if (env.NODE_ENV === "production") {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 401 });
  }

  const summary = await rollupBenchmarks({ withPublic: true });
  return NextResponse.json({ ok: true, ...summary });
}

export const GET = handle;
export const POST = handle;
