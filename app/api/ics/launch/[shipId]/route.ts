import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { resolveAccount } from "@/lib/team";
import { buildLaunchSchedule, launchScheduleICS } from "@/lib/launchSchedule";

/**
 * Download the whole D-7 → D+2 launch schedule as a multi-event calendar.
 * REMINDER ONLY — LaunchWake never posts on your behalf.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ shipId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { shipId } = await ctx.params;
  const { accountId } = await resolveAccount(session.user.id);

  const ship = await db.ship.findFirst({
    where: { id: shipId, project: { userId: accountId } },
    include: {
      plan: {
        include: {
          recs: {
            orderBy: [{ rank: "asc" }, { fitScore: "desc" }],
            include: { channel: true },
          },
        },
      },
    },
  });
  if (!ship) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!ship.launchAt) {
    return NextResponse.json(
      { error: "Set a launch date first." },
      { status: 422 },
    );
  }

  const channels =
    ship.plan?.recs.map((r) => ({
      name: r.channel.name,
      bestTime: r.bestTime ?? r.channel.bestTime,
    })) ?? [];
  const schedule = buildLaunchSchedule(ship.launchAt, channels);
  const ics = launchScheduleICS(ship.id, ship.title, schedule);

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="launchwake-launch-${ship.id}.ics"`,
    },
  });
}
