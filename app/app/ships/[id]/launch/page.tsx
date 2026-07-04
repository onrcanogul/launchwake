import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getWorkspace } from "@/lib/session";
import { getLaunchDay } from "@/lib/plans";
import { getResultsRollup } from "@/lib/attribution";
import { buildLaunchTimeline, groupByWindow } from "@/lib/launchday";
import { isLaunchMode, getLaunchModeState } from "@/lib/launchMode";
import { launchChannelLimit, launchChannelPaywall } from "@/lib/billing";
import { RoiStrip } from "@/components/results/RoiStrip";
import { LaunchDay } from "@/components/ship/LaunchDay";
import { LaunchModeRail } from "@/components/ship/LaunchModeRail";
import { ShareReport } from "@/components/ship/ShareReport";
import { reportUrl } from "@/lib/report";
import { env } from "@/lib/env";
import { ShipSwitcher } from "@/components/ship/ShipSwitcher";
import { SyncActiveShip } from "@/components/ship/SyncActiveShip";
import { EmptyState } from "@/components/ui/EmptyState";
import { Note } from "@/components/ui/Note";
import { Button } from "@/components/ui/Button";
import { emailConfigured } from "@/lib/notify";

export default async function LaunchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ws = await getWorkspace();
  if (!ws.project) redirect("/onboarding");

  const launch = await getLaunchDay(id, ws.accountId);
  if (!launch) notFound();

  const ships = ws.ships;
  const emailAvailable = emailConfigured();
  const slackAvailable = Boolean(ws.project.slackWebhookUrl);

  const inLaunchMode = isLaunchMode(ws.project.launchStage);
  const lm = inLaunchMode
    ? await getLaunchModeState(id, ws.accountId, "launch")
    : null;

  // Free plans launch on their top N channels (the launch set); the rest are a
  // paywall. Attribution across every posted channel is unaffected (the ROI strip
  // still reflects all posts for this ship).
  const channelLimit = inLaunchMode ? launchChannelLimit(ws.plan) : null;
  const steps =
    channelLimit === null ? launch.steps : launch.steps.slice(0, channelLimit);
  const groups = groupByWindow(buildLaunchTimeline(steps));
  const paywall = inLaunchMode
    ? launchChannelPaywall(ws.plan, launch.steps.length)
    : null;

  // Per-launch ROI — fills in as clicks/signups/revenue arrive for this ship.
  const rollup = await getResultsRollup(ws.project.id, { shipId: id });
  const showRoi =
    rollup.roi.clicks > 0 || rollup.roi.signups > 0 || rollup.roi.revenueCents > 0;

  return (
    <>
      <SyncActiveShip id={launch.ship.id} />
      <div className="phead">
        <div>
          <h1 className="pg">Launch day</h1>
          <div className="psub">
            Your run sheet for &ldquo;{launch.ship.title}&rdquo; — each channel in
            the order to post it. Copy the draft, post from your own account, tick
            it off.
          </div>
        </div>
        {ships.length > 1 && (
          <ShipSwitcher ships={ships} currentId={launch.ship.id} mode="launch" />
        )}
      </div>

      {lm && <LaunchModeRail stages={lm.stages} />}

      {launch.steps.length === 0 ? (
        <EmptyState
          icon="calendar"
          title="No plan to run yet"
          message="Build a distribution plan first — Launch day turns it into a time-ordered checklist you can work through."
          actions={
            <Button variant="primary" icon="where" href={`/app/ships/${id}/plan`}>
              Go to plan
            </Button>
          }
        />
      ) : (
        <>
          {showRoi && (
            <RoiStrip roi={rollup.roi} topRevenueChannel={rollup.topRevenueChannel} />
          )}
          <LaunchDay
            shipId={launch.ship.id}
            groups={groups}
            emailAvailable={emailAvailable}
            slackAvailable={slackAvailable}
          />
          {paywall && (
            <Note icon="lock">
              {paywall}{" "}
              <Link href="/app/settings" style={{ color: "var(--ac)" }}>
                Upgrade to Pro
              </Link>
            </Note>
          )}
          <ShareReport
            shipId={launch.ship.id}
            appUrl={env.APP_URL}
            initialUrl={launch.ship.publicToken ? reportUrl(launch.ship.publicToken) : null}
            initialShowRevenue={launch.ship.publicShowRevenue}
          />
          {inLaunchMode && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
              <Button variant="primary" icon="results" href={`/app/ships/${id}/retro`}>
                See your launch retro
              </Button>
            </div>
          )}
        </>
      )}
    </>
  );
}
