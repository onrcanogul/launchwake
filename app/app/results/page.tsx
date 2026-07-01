import { redirect } from "next/navigation";
import { getWorkspace, displayName, projectSubtitle } from "@/lib/session";
import { getResultsRollup } from "@/lib/attribution";
import { AppShell } from "@/components/shell/AppShell";
import { Panel } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";

export default async function ResultsPage() {
  const ws = await getWorkspace();
  if (!ws.project) redirect("/onboarding");

  const { rows, totalSignups, insight } = await getResultsRollup(ws.project.id);

  return (
    <AppShell
      project={{ name: ws.project.name, subtitle: projectSubtitle(ws.project) }}
      user={{ name: displayName(ws.user), plan: ws.user.plan }}
      shipNav={ws.latestShip}
      channelsCount={ws.channelsCount}
      crumb="Results"
    >
      <div className="phead">
        <div>
          <h1 className="pg">Results</h1>
          <div className="psub">
            Which posts drove signups across all your ships. Do more of what
            works.
          </div>
        </div>
        {rows.length > 0 && (
          <Badge accent>{totalSignups} signups tracked</Badge>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon="results"
          title="No data yet"
          message="Post a ship from your own account, add the LaunchWake tracking pixel to your signup page, and this fills with per-channel clicks and conversions."
          actions={
            <Button variant="secondary" icon="settings" href="/app/settings">
              Set up tracking
            </Button>
          }
        />
      ) : (
        <Panel>
          <div className="tblwrap">
            <table>
              <thead>
                <tr>
                  <th>Channel</th>
                  <th>Ship</th>
                  <th style={{ textAlign: "right" }}>Clicks</th>
                  <th style={{ textAlign: "right" }}>Signups</th>
                  <th>Conversion</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td>{r.channelName}</td>
                    <td className="mono" style={{ color: "var(--tx3)" }}>
                      {r.shipTitle}
                    </td>
                    <td className="num" style={{ textAlign: "right" }}>
                      {r.clicks.toLocaleString()}
                    </td>
                    <td
                      className="num"
                      style={{ textAlign: "right", fontWeight: 600 }}
                    >
                      {r.signups}
                    </td>
                    <td>
                      {r.removed ? (
                        <span style={{ color: "var(--bad)" }}>removed</span>
                      ) : (
                        <>
                          {(r.conversion * 100).toFixed(1)}%
                          <div className="cbar">
                            <span
                              style={{
                                width: `${Math.min(100, r.conversion * 100 * 12)}%`,
                              }}
                            />
                          </div>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {insight && (
        <Panel title="What LaunchWake sees" right={<Badge accent>insight</Badge>}>
          <div
            style={{ padding: "15px 16px", color: "var(--tx2)", lineHeight: 1.65 }}
          >
            {insight}
          </div>
        </Panel>
      )}
    </AppShell>
  );
}
