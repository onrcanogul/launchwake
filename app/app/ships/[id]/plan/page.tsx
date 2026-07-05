import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { after } from "next/server";
import { getWorkspace } from "@/lib/session";
import { getShipWithPlan, countAccountPlans } from "@/lib/plans";
import { captureUser, EVENTS } from "@/lib/analytics";
import { ChannelCard, type BenchmarkCardData } from "@/components/channel/ChannelCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Note } from "@/components/ui/Note";
import { Button } from "@/components/ui/Button";
import { RerunButton } from "@/components/ship/RerunButton";
import { ShipSwitcher } from "@/components/ship/ShipSwitcher";
import { SyncActiveShip } from "@/components/ship/SyncActiveShip";
import { AutoBuildPlan } from "@/components/ship/AutoBuildPlan";
import { LaunchModeRail } from "@/components/ship/LaunchModeRail";
import { nextBestTime } from "@/lib/reminders";
import { emailConfigured } from "@/lib/notify";
import { isPaidPlan, launchChannelLimit, launchChannelPaywall } from "@/lib/billing";
import { isLaunchMode, getLaunchModeState } from "@/lib/launchMode";
import { computeAccountReadiness } from "@/lib/accountReadiness";
import { productTagFor, bucketLabel } from "@/lib/stats";
import { getBenchmarkMap, benchmarkDisplay } from "@/lib/benchmarks";

/** Hide digits so a Free (locked) client never receives the real number. */
function maskValue(value: string): string {
  return value.replace(/\d+/g, (m) => "•".repeat(Math.max(2, m.length)));
}

export default async function PlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ws = await getWorkspace();
  if (!ws.project) redirect("/onboarding");

  const data = await getShipWithPlan(id, ws.accountId);
  if (!data) notFound();

  const { ship, recs } = data;
  const ships = ws.ships;
  const emailAvailable = emailConfigured();
  const slackAvailable = Boolean(ws.project.slackWebhookUrl);
  const building = recs.length === 0 && ship.status === "NEW";

  // Funnel: activation = seeing a real plan for your own product. Only the
  // account's first-ever plan counts; PostHog dedupes repeat views per user.
  if (recs.length > 0 && (await countAccountPlans(ws.accountId)) === 1) {
    after(() => captureUser(ws.user.id, EVENTS.firstPlanViewed));
  }

  // Launch Mode: show the guided rail and cap how many channels a Free plan can
  // launch on (the full ranking is still shown; the rest are locked below).
  const inLaunchMode = isLaunchMode(ws.project.launchStage);
  const lm = inLaunchMode
    ? await getLaunchModeState(id, ws.accountId, "plan")
    : null;
  const channelLimit = inLaunchMode ? launchChannelLimit(ws.plan) : null;
  const visibleRecs = channelLimit === null ? recs : recs.slice(0, channelLimit);
  const lockedRecs = channelLimit === null ? [] : recs.slice(channelLimit);
  const paywall = inLaunchMode
    ? launchChannelPaywall(ws.plan, recs.length)
    : null;

  // Category benchmarks — the paywall trigger. Free sees the label + a masked,
  // blurred number ("unlock with Pro"); paid sees the real figure.
  const productTag = productTagFor(
    `${ws.project.name} ${ws.project.description ?? ""} ${ws.project.url ?? ""}`,
  );
  const categoryLabel = bucketLabel(productTag);
  const benchmarks = await getBenchmarkMap(productTag);
  const locked = !isPaidPlan(ws.plan);

  // Account readiness (launch mode only): warn/prepare founders posting from
  // fresh accounts. Computed at render from the current launch date, so it
  // stays accurate even if the date changed after the plan was built.
  const now = new Date();
  const readinessFor = (rec: (typeof recs)[number]) =>
    inLaunchMode
      ? computeAccountReadiness(rec.accountRequirements, {
          launchAt: ship.launchAt,
          now,
          channelName: rec.channelName,
        })
      : null;

  const benchmarkFor = (channelSlug: string): BenchmarkCardData | null => {
    const view = benchmarks.get(channelSlug);
    if (!view) return null;
    const display = benchmarkDisplay(view, categoryLabel);
    if (!display) return null;
    return {
      label: display.label,
      value: locked ? maskValue(display.value) : display.value,
      sub: locked ? null : display.sub,
      locked,
    };
  };

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

      {lm && <LaunchModeRail stages={lm.stages} />}

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
        <>
          {visibleRecs.map((rec) => {
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
                benchmark={benchmarkFor(rec.channelSlug)}
                accountReadiness={readinessFor(rec)}
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
          })}

          {paywall && lockedRecs.length > 0 && (
            <>
              <Note icon="lock" className="note-flow">
                {paywall} <Link href="/app/settings">Upgrade to Pro</Link>
              </Note>
              <div className="plan-locked" aria-hidden>
                {lockedRecs.map((rec) => (
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
                    draftHref="/app/settings"
                    benchmark={benchmarkFor(rec.channelSlug)}
                    accountReadiness={readinessFor(rec)}
                  />
                ))}
              </div>
            </>
          )}

          {inLaunchMode ? (
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
              <Button variant="primary" icon="kit" href={`/app/ships/${ship.id}/kit`}>
                Continue to launch kit
              </Button>
            </div>
          ) : (
            <Note icon="results" className="note-flow">
              This plan re-ranks itself as results come in — LaunchWake learns which
              channels actually convert for products like yours, so every launch
              gets smarter.
            </Note>
          )}
        </>
      )}
    </>
  );
}
