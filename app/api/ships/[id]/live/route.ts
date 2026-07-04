import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { resolveAccount } from "@/lib/team";
import { getShipLiveStats } from "@/lib/attribution";

/**
 * Live per-channel click/signup counts for one ship — polled by the plan page so
 * the founder sees tracking working without reloading. Read-only; scoped to the
 * signed-in account. Never posts anything.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const { accountId } = await resolveAccount(session.user.id);

  const stats = await getShipLiveStats(id, accountId);
  if (!stats) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(stats, {
    headers: { "Cache-Control": "no-store" },
  });
}
