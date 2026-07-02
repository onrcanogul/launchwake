import { redirect } from "next/navigation";
import { getWorkspace } from "@/lib/session";
import { getResultsRollup, formatMoney } from "@/lib/attribution";
import { RoiStrip } from "@/components/results/RoiStrip";
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
        <Badge accent>
          {r.totalRevenueCents > 0
            ? `${formatMoney(r.totalRevenueCents, r.currency)} attributed`
            : `${r.totalSignups} signups tracked`}
        </Badge>
      )}
    </div>
  );

  const hasRevenue = r.totalRevenueCents > 0;

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
    hasRevenue
      ? {
          label: "Revenue attributed",
          value: formatMoney(r.totalRevenueCents, r.currency),
          detailUp: true,
          detail: r.mrrCents > 0 ? `${formatMoney(r.mrrCents, r.currency)} recurring` : "one-time",
        }
      : {
          label: "Conversion",
          value: `${(r.conversion * 100).toFixed(1)}%`,
          detail: "clicks → signups",
        },
    {
      label: hasRevenue ? "Top by revenue" : "Best channel",
      value: (hasRevenue ? r.topRevenueChannel?.name : r.bestChannel) ?? "—",
      smallValue: true,
      detail: hasRevenue ? "by money" : r.bestChannel ? "by signups" : "post to see",
    },
  ];

  return (
    <>
      {header}
      {r.roi.posts > 0 && (
        <RoiStrip roi={r.roi} topRevenueChannel={r.topRevenueChannel} />
      )}
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
                {hasRevenue && <th style={{ textAlign: "right" }}>Revenue</th>}
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
                  {hasRevenue && (
                    <td
                      className="num"
                      style={{ textAlign: "right", fontWeight: 600, color: c.revenueCents > 0 ? "var(--ac)" : "var(--tx3)" }}
                    >
                      {c.revenueCents > 0 ? formatMoney(c.revenueCents, r.currency) : "—"}
                    </td>
                  )}
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
                {hasRevenue && <th style={{ textAlign: "right" }}>Revenue</th>}
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
                  {hasRevenue && (
                    <td
                      className="num"
                      style={{ textAlign: "right", fontWeight: 600, color: p.revenueCents > 0 ? "var(--ac)" : "var(--tx3)" }}
                    >
                      {p.revenueCents > 0 ? formatMoney(p.revenueCents, r.currency) : "—"}
                    </td>
                  )}
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
