import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { nextBestTime, buildICS } from "@/lib/reminders";

/**
 * Download a calendar reminder to post a channel at its best time.
 * REMINDER ONLY — LaunchWake never posts on your behalf.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ recId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { recId } = await ctx.params;

  const rec = await db.recommendation.findFirst({
    where: { id: recId, plan: { ship: { project: { userId: session.user.id } } } },
    include: {
      channel: true,
      plan: { include: { ship: { select: { title: true } } } },
    },
  });
  if (!rec) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const start = nextBestTime(rec.bestTime ?? rec.channel.bestTime, new Date());
  if (!start) {
    return NextResponse.json(
      { error: "This channel has no scheduled best time." },
      { status: 422 },
    );
  }

  const shipTitle = rec.plan.ship.title;
  const ics = buildICS({
    uid: `launchwake-${rec.id}@launchwake.dev`,
    title: `Post "${shipTitle}" to ${rec.channel.name}`,
    description: `Best time to post per LaunchWake${
      rec.bestTime ? ` (${rec.bestTime})` : ""
    }. ${rec.ruleNote ?? ""}\n\nReminder only — you post it yourself.`,
    start,
  });

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="launchwake-${rec.channel.slug}.ics"`,
    },
  });
}
