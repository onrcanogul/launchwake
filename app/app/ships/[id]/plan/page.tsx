import { notFound, redirect } from "next/navigation";
import { getWorkspace } from "@/lib/session";
import { getShipWithPlan } from "@/lib/plans";
import { ChannelCard } from "@/components/channel/ChannelCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { RerunButton } from "@/components/ship/RerunButton";
import { ShipSwitcher } from "@/components/ship/ShipSwitcher";
import { SyncActiveShip } from "@/components/ship/SyncActiveShip";
import { AutoBuildPlan } from "@/components/ship/AutoBuildPlan";
import { nextBestTime } from "@/lib/reminders";
import { emailConfigured } from "@/lib/notify";

export default async function PlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ws = await getWorkspace();
  if (!ws.project) redirect("/onboarding");

  const data = await getShipWithPlan(id, ws.user.id);
  if (!data) notFound();

  const { ship, recs } = data;
  const ships = ws.ships;
  const emailAvailable = emailConfigured();
  const slackAvailable = Boolean(ws.project.slackWebhookUrl);
  const building = recs.length === 0 && ship.status === "NEW";

  return (
    <>
      <SyncActiveShip id={ship.id} />
      <div className="phead">
        <div>
          <h1 className="pg">Where to post</h1>
          <div className="psub">
            {building ? (
              <>
                Analyzing where your users are for{" "}
                <b style={{ color: "var(--tx)" }}>&ldquo;{ship.title}&rdquo;</b>…
              </>
            ) : (
              <>
                Distribution plan for{" "}
                <b style={{ color: "var(--tx)" }}>&ldquo;{ship.title}&rdquo;</b> —{" "}
                {recs.length} channel{recs.length === 1 ? "" : "s"} ranked by fit,
                with rules and the safe way in.
              </>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 9, alignItems: "center" }}>
          {ships.length > 1 && (
            <ShipSwitcher ships={ships} currentId={ship.id} mode="plan" />
          )}
          {recs.length > 0 && <RerunButton shipId={ship.id} />}
        </div>
      </div>

      {recs.length === 0 && ship.status === "NEW" ? (
        <>
          <AutoBuildPlan shipId={ship.id} />
          {[0, 1, 2].map((i) => (
            <div className="chan" key={i}>
              <div className="top">
                <div className="ico">
                  <div className="skel" style={{ width: 17, height: 17 }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div
                    className="skel"
                    style={{ width: 180, height: 13, marginBottom: 6 }}
                  />
                  <div className="skel" style={{ width: 120, height: 11 }} />
                </div>
                <div className="skel" style={{ width: 64, height: 12 }} />
              </div>
              <div style={{ padding: "0 17px 13px" }}>
                <div className="skel" style={{ width: "80%", height: 12 }} />
              </div>
              <div className="ft">
                <div className="skel" style={{ width: 220, height: 12 }} />
              </div>
            </div>
          ))}
        </>
      ) : recs.length === 0 ? (
        <EmptyState
          icon="where"
          title="No plan yet"
          message="We couldn't find a distribution plan for this ship. Build one to see where its audience gathers."
          actions={
            <Button variant="primary" icon="target" href="/app/ships/new">
              Build a plan
            </Button>
          }
        />
      ) : (
        recs.map((rec) => {
          const schedulable = nextBestTime(rec.bestTime, new Date()) !== null;
          return (
            <ChannelCard
              key={rec.id}
              data={{
                name: rec.channelName,
                platform: rec.platform,
                audienceDesc: rec.audienceDesc,
                fitScore: rec.fitScore,
                banRisk: rec.banRisk,
                bestTime: rec.bestTime,
                whyText: rec.whyText,
                ruleNote: rec.ruleNote,
                outcomeNote: rec.outcomeNote,
              }}
              draftHref={`/app/ships/${ship.id}/kit?rec=${rec.id}`}
              remind={
                schedulable
                  ? {
                      recId: rec.id,
                      icsHref: `/api/ics/${rec.id}`,
                      emailAvailable,
                      slackAvailable,
                    }
                  : undefined
              }
            />
          );
        })
      )}
    </>
  );
}
