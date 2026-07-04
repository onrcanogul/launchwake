import { notFound, redirect } from "next/navigation";
import { getWorkspace } from "@/lib/session";
import { getLaunchModeState } from "@/lib/launchMode";
import { getShipWithPlan } from "@/lib/plans";
import { buildLaunchSchedule } from "@/lib/launchSchedule";
import { emailConfigured } from "@/lib/notify";
import { LaunchModeRail } from "@/components/ship/LaunchModeRail";
import { LaunchScheduleForm } from "@/components/ship/LaunchScheduleForm";
import { SyncActiveShip } from "@/components/ship/SyncActiveShip";
import { Panel } from "@/components/ui/Panel";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";

function offsetLabel(offset: number): string {
  if (offset === 0) return "Launch day";
  return `D${offset > 0 ? "+" : ""}${offset}`;
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default async function SchedulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ws = await getWorkspace();
  if (!ws.project) redirect("/onboarding");

  const state = await getLaunchModeState(id, ws.accountId, "schedule");
  if (!state) notFound();
  if (state.project.launchStage === "LAUNCHED") {
    redirect(`/app/ships/${id}/launch`);
  }

  const plan = await getShipWithPlan(id, ws.accountId);
  const channels =
    plan?.recs.map((r) => ({ name: r.channelName, bestTime: r.bestTime })) ?? [];
  const hasPlan = channels.length > 0;

  const launchAt = state.ship.launchAt;
  const dateStr = launchAt ? launchAt.toISOString().slice(0, 10) : null;
  // Real dates once scheduled; otherwise just the D-offset structure.
  const schedule = buildLaunchSchedule(launchAt ?? new Date(), channels);

  return (
    <>
      <SyncActiveShip id={state.ship.id} />
      <div className="phead">
        <div>
          <h1 className="pg">Schedule &amp; rehearsal</h1>
          <div className="psub">
            Pick a launch date and LaunchWake lays out the D-7 → D+2 run-up, with
            a reminder the day before. You still post everything yourself.
          </div>
        </div>
      </div>

      <LaunchModeRail stages={state.stages} />

      {!hasPlan ? (
        <EmptyState
          icon="calendar"
          title="Build your plan first"
          message="The launch schedule is built from your channels' best posting times — create a distribution plan to unlock it."
          actions={
            <Button variant="primary" icon="where" href={`/app/ships/${id}/plan`}>
              Go to plan
            </Button>
          }
        />
      ) : (
        <>
          <Panel title="Launch date">
            <LaunchScheduleForm
              shipId={id}
              initialDate={dateStr}
              emailAvailable={emailConfigured()}
              slackAvailable={Boolean(ws.project.slackWebhookUrl)}
              icsHref={`/api/ics/launch/${id}`}
            />
          </Panel>

          <Panel
            title={launchAt ? "Your run-up" : "The run-up (set a date to lock it in)"}
          >
            <ol className="lm-timeline">
              {schedule.map((m) => (
                <li key={m.offset} className={`lm-tl-item k-${m.kind}`}>
                  <div className="lm-tl-when">
                    <b>{offsetLabel(m.offset)}</b>
                    {launchAt && <span>{fmtDate(m.date)}</span>}
                  </div>
                  <div className="lm-tl-body">
                    <b>{m.title}</b>
                    <p>{m.detail}</p>
                    {m.channels && m.channels.length > 0 && (
                      <div className="lm-tl-chans">
                        {m.channels.map((c, i) => (
                          <span key={i} className="lm-tl-chip">
                            {c.name}
                            <em>{c.timeLabel}</em>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </Panel>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button variant="primary" icon="rocket" href={`/app/ships/${id}/launch`}>
              Continue to launch day
            </Button>
          </div>
        </>
      )}
    </>
  );
}
