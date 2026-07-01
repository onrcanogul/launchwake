import { redirect } from "next/navigation";
import { getWorkspace } from "@/lib/session";
import { getResultsRollup } from "@/lib/attribution";
import { Panel } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { StatStrip, type Stat } from "@/components/ui/StatStrip";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";

function ConversionCell({
  conversion,
  removed,
}: {
  conversion: number;
  removed?: boolean;
}) {
  if (removed) return <span style={{ color: "var(--bad)" }}>removed</span>;
  return (
    <>
      {(conversion * 100).toFixed(1)}%
      <div className="cbar">
        <span style={{ width: `${Math.min(100, conversion * 100 * 12)}%` }} />
      </div>
    </>
  );
}

export default async function ResultsPage() {
  const ws = await getWorkspace();
  if (!ws.project) redirect("/onboarding");

  const r = await getResultsRollup(ws.project.id);

  const header = (
    <div className="phead">
      <div>
        <h1 className="pg">Results</h1>
        <div className="psub">
          Every post → click → signup, attributed. Do more of what brings
          customers.
        </div>
      </div>
      {r.perPost.length > 0 && (
        <Badge accent>{r.totalSignups} signups tracked</Badge>
      )}
    </div>
  );

  if (r.perPost.length === 0) {
    return (
      <>
        {header}
        <EmptyState
          icon="results"
          title="No data yet"
          message="Mark a ship as posted to mint a tracked link, add the LaunchWake pixel to your signup page, and this fills with per-channel clicks and conversions."
          actions={
            <>
              <Button variant="primary" icon="where" href="/app/plan">
                Go to a plan
              </Button>
              <Button variant="secondary" icon="settings" href="/app/settings">
                Set up tracking
              </Button>
            </>
          }
        />
      </>
    );
  }

  const stats: Stat[] = [
    { label: "Clicks tracked", value: r.totalClicks.toLocaleString() },
    {
      label: "Signups driven",
      value: r.totalSignups.toLocaleString(),
      detailUp: r.totalSignups > 0,
      detail: r.totalSignups > 0 ? "attributed" : "add the pixel",
    },
    {
      label: "Conversion",
      value: `${(r.conversion * 100).toFixed(1)}%`,
      detail: "clicks → signups",
    },
    {
      label: "Best channel",
      value: r.bestChannel ?? "—",
      smallValue: true,
      detail: r.bestChannel ? "by signups" : "post to see",
    },
  ];

  return (
    <>
      {header}
      <StatStrip stats={stats} />

      <Panel title="By channel" right="across all ships">
        <div className="tblwrap">
          <table>
            <thead>
              <tr>
                <th>Channel</th>
                <th style={{ textAlign: "right" }}>Posts</th>
                <th style={{ textAlign: "right" }}>Clicks</th>
                <th style={{ textAlign: "right" }}>Signups</th>
                <th>Conversion</th>
              </tr>
            </thead>
            <tbody>
              {r.perChannel.map((c) => (
                <tr key={c.channelName}>
                  <td>
                    <b>{c.channelName}</b>
                  </td>
                  <td className="num" style={{ textAlign: "right" }}>
                    {c.posts}
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
                  <td>
                    <ConversionCell conversion={c.conversion} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="By post" right={`${r.perPost.length} posts`}>
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
              {r.perPost.map((p, i) => (
                <tr key={i}>
                  <td>{p.channelName}</td>
                  <td className="mono" style={{ color: "var(--tx3)" }}>
                    {p.shipTitle}
                  </td>
                  <td className="num" style={{ textAlign: "right" }}>
                    {p.clicks.toLocaleString()}
                  </td>
                  <td
                    className="num"
                    style={{ textAlign: "right", fontWeight: 600 }}
                  >
                    {p.signups}
                  </td>
                  <td>
                    <ConversionCell
                      conversion={p.conversion}
                      removed={p.removed}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {r.insight && (
        <Panel title="What LaunchWake sees" right={<Badge accent>insight</Badge>}>
          <div
            style={{ padding: "15px 16px", color: "var(--tx2)", lineHeight: 1.65 }}
          >
            {r.insight}
          </div>
        </Panel>
      )}
    </>
  );
}
