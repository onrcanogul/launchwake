import { notFound, redirect } from "next/navigation";
import { getWorkspace } from "@/lib/session";
import { getLaunchModeState } from "@/lib/launchMode";
import { getShipWithPlan } from "@/lib/plans";
import { computeAccountReadiness } from "@/lib/accountReadiness";
import { env } from "@/lib/env";
import { LaunchModeRail } from "@/components/ship/LaunchModeRail";
import { SyncActiveShip } from "@/components/ship/SyncActiveShip";
import { Checklist } from "@/components/ui/Checklist";
import {
  AccountReadinessChecklist,
  type AccountReadyChannel,
} from "@/components/ship/AccountReadinessChecklist";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { TrackingSetup } from "@/components/settings/TrackingSetup";

export default async function ReadinessPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ws = await getWorkspace();
  if (!ws.project) redirect("/onboarding");

  const state = await getLaunchModeState(id, ws.accountId, "readiness");
  if (!state) notFound();

  // Launch Mode is for pre/unannounced products; a launched project has no
  // readiness stage — send it to its plan.
  if (state.project.launchStage === "LAUNCHED") {
    redirect(`/app/ships/${id}/plan`);
  }

  const { readiness } = state;

  // Per-channel account readiness (launch mode): warn + prepare founders posting
  // from fresh accounts. Computed from the plan's recommended channels + the
  // chosen launch date; empty until a plan exists or none carry requirements.
  const plan = await getShipWithPlan(id, ws.accountId);
  const now = new Date();
  const accountChannels: AccountReadyChannel[] = (plan?.recs ?? [])
    .map((rec): AccountReadyChannel | null => {
      const block = computeAccountReadiness(rec.accountRequirements, {
        launchAt: plan?.ship.launchAt ?? null,
        now,
        channelName: rec.channelName,
      });
      return block
        ? {
            slug: rec.channelSlug,
            channelName: rec.channelName,
            platform: rec.platform,
            block,
          }
        : null;
    })
    .filter((c): c is AccountReadyChannel => c !== null);

  const scoreColor = readiness.ready ? "var(--ac)" : "var(--warn)";
  const nextLabel =
    state.nextKey === "plan"
      ? "Build distribution plan"
      : state.nextKey === "readiness"
        ? "Build distribution plan"
        : "Continue";
  const nextHref =
    state.nextKey === "readiness" || state.nextKey === "plan"
      ? `/app/ships/${id}/plan`
      : `/app/ships/${id}/${state.nextKey}`;

  return (
    <>
      <SyncActiveShip id={state.ship.id} />
      <div className="phead">
        <div>
          <h1 className="pg">Launch readiness</h1>
          <div className="psub">
            Get set up before you launch &ldquo;{state.ship.title}&rdquo; — so
            launch day pays off in tracked signups, not silence.
          </div>
        </div>
      </div>

      <LaunchModeRail stages={state.stages} />

      <div className="rd-score">
        <div className="rd-num" style={{ color: scoreColor }}>
          {readiness.score}
        </div>
        <div className="rd-meta">
          <b>
            {readiness.ready
              ? "You're ready to launch"
              : "A few steps to launch-ready"}
          </b>
          <p>
            {readiness.items.filter((i) => i.done).length} of{" "}
            {readiness.items.length} done · attribution weighted heaviest
          </p>
          <div className="rd-bar" aria-hidden>
            <span
              style={{ width: `${readiness.score}%`, background: scoreColor }}
            />
          </div>
        </div>
        <Button variant="primary" icon="where" href={nextHref}>
          {nextLabel}
        </Button>
      </div>

      <Panel title="Readiness checklist">
        <div style={{ padding: "6px 16px 14px" }}>
          <Checklist
            items={readiness.items.map((i) => ({
              title: i.title,
              hint: i.hint,
              done: i.done,
            }))}
          />
        </div>
      </Panel>

      {accountChannels.length > 0 && (
        <Panel title="Account readiness">
          <div style={{ padding: "10px 16px 16px" }}>
            <p
              style={{
                fontSize: 12,
                color: "var(--tx2)",
                margin: "0 0 12px",
                lineHeight: 1.5,
              }}
            >
              Most launch-day bans hit fresh, zero-history accounts. Set up and
              warm up each account well before launch, then check it off here.
            </p>
            <AccountReadinessChecklist
              shipId={state.ship.id}
              channels={accountChannels}
            />
          </div>
        </Panel>
      )}

      <Panel title="Attribution — the launch-day reward">
        <TrackingSetup
          appUrl={env.APP_URL}
          projectId={state.project.id}
          status={state.tracking}
          stripeSecretSet={state.stripeSecretSet}
          pixelVerifiedAt={state.pixelVerifiedAt}
        />
      </Panel>
    </>
  );
}
