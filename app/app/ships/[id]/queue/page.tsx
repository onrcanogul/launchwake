import { notFound, redirect } from "next/navigation";
import { getWorkspace } from "@/lib/session";
import { getShipWithPlan } from "@/lib/plans";
import { getShipQueue, dueLabel } from "@/lib/queue";
import { DistributionQueue, type QueueGroupUI } from "@/components/queue/DistributionQueue";
import { EmptyState } from "@/components/ui/EmptyState";
import { Note } from "@/components/ui/Note";
import { Button } from "@/components/ui/Button";
import { ShipSwitcher } from "@/components/ship/ShipSwitcher";
import { SyncActiveShip } from "@/components/ship/SyncActiveShip";

export const metadata = { title: "Distribution queue · LaunchWake" };

export default async function QueuePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ws = await getWorkspace();
  if (!ws.project) redirect("/onboarding");

  const data = await getShipWithPlan(id, ws.accountId);
  if (!data) notFound();
  const { ship } = data;

  const groups = await getShipQueue(id);
  const now = new Date();
  const ui: QueueGroupUI[] = groups.map((g) => ({
    phase: g.phase,
    label: g.label,
    blurb: g.blurb,
    weekLabel: g.weekLabel,
    tasks: g.tasks.map((t) => ({
      id: t.id,
      channelName: t.channelName,
      platform: t.platform,
      channelUrl: t.channelUrl,
      rules: t.rules,
      due: dueLabel(t.dueAt, now),
      status: t.status,
    })),
  }));

  const total = ui.reduce((n, g) => n + g.tasks.length, 0);
  const done = ui.reduce((n, g) => n + g.tasks.filter((t) => t.status === "DONE").length, 0);

  return (
    <>
      <SyncActiveShip id={ship.id} />
      <div className="phead">
        <div>
          <h1 className="pg">Distribution queue</h1>
          <div className="psub">
            The cadence for{" "}
            <b style={{ color: "var(--tx)" }}>&ldquo;{ship.title}&rdquo;</b> — a launch
            isn&apos;t a day. {total > 0 ? `${done}/${total} tasks done.` : ""}
          </div>
        </div>
        {ws.ships.length > 1 && (
          <ShipSwitcher ships={ws.ships} currentId={ship.id} mode="queue" />
        )}
      </div>

      {ui.length === 0 ? (
        <EmptyState
          icon="calendar"
          title="No queue yet"
          message="Your distribution cadence is laid down when you build a plan for this ship — week-1 directories through a month-3 Show HN relaunch."
          actions={
            <Button variant="primary" icon="where" href={`/app/ships/${ship.id}/plan`}>
              Build the plan
            </Button>
          }
        />
      ) : (
        <>
          <DistributionQueue groups={ui} />
          <Note icon="calendar">
            Each task&apos;s due date drives your Monday digest — &ldquo;this week&apos;s
            tasks&rdquo; land in your inbox so the launch never goes quiet. You post
            everything yourself; we just keep the cadence.
          </Note>
        </>
      )}
    </>
  );
}
