import { notFound, redirect } from "next/navigation";
import { getWorkspace } from "@/lib/session";
import { getLaunchModeState } from "@/lib/launchMode";
import { getResultsRollup, formatMoney } from "@/lib/attribution";
import { getBenchmarkMap, type ChannelBenchmarkView } from "@/lib/benchmarks";
import { productTagFor, bucketLabel } from "@/lib/stats";
import { getGithubStatus } from "@/lib/github";
import { isPaidPlan } from "@/lib/billing";
import { env } from "@/lib/env";
import { reportUrl } from "@/lib/report";
import { LaunchModeRail } from "@/components/ship/LaunchModeRail";
import { SyncActiveShip } from "@/components/ship/SyncActiveShip";
import { RoiStrip } from "@/components/results/RoiStrip";
import { ShareReport } from "@/components/ship/ShareReport";
import { GithubWebhook } from "@/components/settings/GithubWebhook";
import { CompleteLaunchButton } from "@/components/ship/CompleteLaunchButton";
import { Panel } from "@/components/ui/Panel";
import { Note } from "@/components/ui/Note";
import { Button } from "@/components/ui/Button";
import Link from "next/link";

export default async function RetroPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ws = await getWorkspace();
  if (!ws.project) redirect("/onboarding");

  // Retro is the terminal Launch Mode stage — it does NOT redirect when the
  // project is already LAUNCHED (that's the completed state it renders).
  const state = await getLaunchModeState(id, ws.accountId, "retro");
  if (!state) notFound();

  const completed = state.project.launchStage === "LAUNCHED";
  const rollup = await getResultsRollup(ws.project.id, { shipId: id });

  // Category benchmarks (Pro-gated) → per-channel "you vs the median".
  const productTag = productTagFor(
    `${ws.project.name} ${ws.project.description ?? ""} ${ws.project.url ?? ""}`,
  );
  const categoryLabel = bucketLabel(productTag);
  const benchmarks = await getBenchmarkMap(productTag);
  const benchByName = new Map<string, ChannelBenchmarkView>();
  for (const v of benchmarks.values()) benchByName.set(v.channelName, v);
  const paid = isPaidPlan(ws.plan);
  const hasRevenue = rollup.totalRevenueCents > 0;

  const github = await getGithubStatus(ws.project);
  const webhookUrl = `${env.APP_URL.replace(/\/$/, "")}/api/github/webhook`;

  return (
    <>
      <SyncActiveShip id={state.ship.id} />
      <div className="phead">
        <div>
          <h1 className="pg">Launch retro</h1>
          <div className="psub">
            What &ldquo;{state.ship.title}&rdquo; actually drove — per channel,
            against the {categoryLabel} median. Share it, then keep shipping.
          </div>
        </div>
      </div>

      <LaunchModeRail stages={state.stages} />

      {rollup.roi.posts > 0 && (
        <RoiStrip roi={rollup.roi} topRevenueChannel={rollup.topRevenueChannel} />
      )}

      <Panel title="Per-channel results" right={`vs ${categoryLabel} median`}>
        <div className="tblwrap">
          <table>
            <thead>
              <tr>
                <th>Channel</th>
                <th style={{ textAlign: "right" }}>Clicks</th>
                <th style={{ textAlign: "right" }}>Signups</th>
                {hasRevenue && <th style={{ textAlign: "right" }}>Revenue</th>}
                <th style={{ textAlign: "right" }}>vs median</th>
              </tr>
            </thead>
            <tbody>
              {rollup.perChannel.length === 0 ? (
                <tr>
                  <td colSpan={hasRevenue ? 5 : 4} style={{ color: "var(--tx3)" }}>
                    No attributed results yet — they fill in as clicks and signups
                    arrive. Make sure the tracking snippet is installed.
                  </td>
                </tr>
              ) : (
                rollup.perChannel.map((c) => {
                  const bench = benchByName.get(c.channelName);
                  const median = bench?.medianSignups ?? null;
                  return (
                    <tr key={c.channelName}>
                      <td>
                        <b>{c.channelName}</b>
                      </td>
                      <td className="num" style={{ textAlign: "right" }}>
                        {c.clicks.toLocaleString()}
                      </td>
                      <td
                        className="num"
                        style={{ textAlign: "right", fontWeight: 600 }}
                      >
                        {c.signups}
                      </td>
                      {hasRevenue && (
                        <td
                          className="num"
                          style={{
                            textAlign: "right",
                            fontWeight: 600,
                            color: c.revenueCents > 0 ? "var(--ac)" : "var(--tx3)",
                          }}
                        >
                          {c.revenueCents > 0
                            ? formatMoney(c.revenueCents, rollup.currency)
                            : "—"}
                        </td>
                      )}
                      <td className="num" style={{ textAlign: "right" }}>
                        {median === null ? (
                          <span style={{ color: "var(--tx3)" }}>—</span>
                        ) : !paid ? (
                          <Link
                            href="/app/settings"
                            style={{ color: "var(--ac)" }}
                            title="Unlock category benchmarks with Pro"
                          >
                            Pro
                          </Link>
                        ) : (
                          <span
                            style={{
                              color:
                                c.signups >= median
                                  ? "var(--ok)"
                                  : "var(--tx2)",
                            }}
                          >
                            {c.signups >= median ? "▲" : "▼"} {median} median
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      <ShareReport
        shipId={state.ship.id}
        appUrl={env.APP_URL}
        initialUrl={
          state.ship.publicToken ? reportUrl(state.ship.publicToken) : null
        }
        initialShowRevenue={state.ship.publicShowRevenue}
      />

      {!completed ? (
        <Panel title="Wrap up your launch">
          <div style={{ padding: "14px 16px" }}>
            <p style={{ color: "var(--tx2)", fontSize: 13, marginBottom: 14 }}>
              Done launching? Switch to Growth Mode — LaunchWake turns every future
              release, feature and post into its own distribution moment.
            </p>
            <CompleteLaunchButton shipId={state.ship.id} />
          </div>
        </Panel>
      ) : (
        <>
          <Note icon="check">
            Launch complete — you&apos;re in Growth Mode now. Set up the loop below
            so your next ship distributes itself.
          </Note>

          <Panel title="Auto-detect your next ship" right="GitHub webhook">
            <GithubWebhook
              repo={ws.project.githubRepo}
              webhookUrl={webhookUrl}
              initialSecret={ws.project.webhookSecret}
              status={github}
            />
          </Panel>

          <Panel title="Or get a weekly nudge">
            <div style={{ padding: "14px 16px" }}>
              <p style={{ color: "var(--tx2)", fontSize: 13, marginBottom: 14 }}>
                LaunchWake emails you a weekly digest — undistributed ships, this
                week&apos;s queue tasks, and what converted. Connect email or Slack
                in Settings to choose how you hear about it.
              </p>
              <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
                <Button variant="secondary" icon="settings" href="/app/settings">
                  Notification settings
                </Button>
                <Button variant="primary" icon="grid" href="/app">
                  Go to your ship feed
                </Button>
              </div>
            </div>
          </Panel>
        </>
      )}
    </>
  );
}
