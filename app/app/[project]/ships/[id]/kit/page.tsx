import Link from "next/link";
import { notFound } from "next/navigation";
import { getWorkspace } from "@/lib/session";
import { getShipKit } from "@/lib/plans";
import { isLaunchMode, getLaunchModeState } from "@/lib/launchMode";
import { launchChannelLimit, launchChannelPaywall } from "@/lib/billing";
import { LaunchKit } from "@/components/ship/LaunchKit";
import { LaunchModeRail } from "@/components/ship/LaunchModeRail";
import { ShipSwitcher } from "@/components/ship/ShipSwitcher";
import { SyncActiveShip } from "@/components/ship/SyncActiveShip";
import { EmptyState } from "@/components/ui/EmptyState";
import { Note } from "@/components/ui/Note";
import { Button } from "@/components/ui/Button";

export default async function KitPage({
  params,
  searchParams,
}: {
  params: Promise<{ project: string; id: string }>;
  searchParams: Promise<{ rec?: string }>;
}) {
  const { project, id } = await params;
  const { rec } = await searchParams;
  const ws = await getWorkspace(project);

  const kit = await getShipKit(id, ws.accountId);
  if (!kit) notFound();

  const ships = ws.ships;
  const inLaunchMode = isLaunchMode(ws.project.launchStage);
  const lm = inLaunchMode
    ? await getLaunchModeState(id, ws.accountId, "kit")
    : null;

  // Free plans draft only their launch set (top N) — keeps the cap consistent
  // with the plan page. The rest are surfaced as a paywall, not drafted.
  const channelLimit = inLaunchMode ? launchChannelLimit(ws.plan) : null;
  const visibleRecs =
    channelLimit === null ? kit.recs : kit.recs.slice(0, channelLimit);
  const paywall = inLaunchMode
    ? launchChannelPaywall(ws.plan, kit.recs.length)
    : null;

  return (
    <>
      <SyncActiveShip id={kit.ship.id} />
      <div className="phead">
        <div>
          <h1 className="pg">Launch kit</h1>
          <div className="psub">
            Drafts for &ldquo;{kit.ship.title}&rdquo;. Copy, tweak, and post from
            your own account — LaunchWake never posts for you.
          </div>
        </div>
        {ships.length > 1 && (
          <ShipSwitcher
            projectId={project}
            ships={ships}
            currentId={kit.ship.id}
            mode="kit"
          />
        )}
      </div>

      {lm && <LaunchModeRail stages={lm.stages} />}

      {kit.recs.length === 0 ? (
        <EmptyState
          icon="kit"
          title="No channels to draft for"
          message="Build a distribution plan first — the launch kit generates a draft per recommended channel."
          actions={
            <Button variant="primary" icon="where" href={`/app/${project}/ships/${id}/plan`}>
              Go to plan
            </Button>
          }
        />
      ) : (
        <>
          <LaunchKit recs={visibleRecs} initialRecId={rec} />
          {paywall && (
            <Note icon="lock" className="note-flow">
              {paywall} <Link href={`/app/${project}/settings`}>Upgrade to Pro</Link>
            </Note>
          )}
          {inLaunchMode && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
              <Button
                variant="primary"
                icon="calendar"
                href={`/app/${project}/ships/${id}/schedule`}
              >
                Continue to schedule
              </Button>
            </div>
          )}
        </>
      )}
    </>
  );
}
