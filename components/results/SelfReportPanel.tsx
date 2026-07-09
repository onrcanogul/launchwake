import { Panel } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import type { SelfReportView } from "@/lib/attribution";

function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

/**
 * "Where signups say they came from" — the dark-social attribution panel. Shows
 * the self-reported source mix, how much of it a tracked link never saw, and
 * (when there's overlap) how often the link disagreed with the human. This is
 * the answer to "UTM alone misattributes most conversions".
 */
export function SelfReportPanel({ report }: { report: SelfReportView }) {
  if (report.total === 0) return null;

  const dark = report.darkSocialShare;

  return (
    <>
      <Panel
        title="Where signups say they came from"
        right={<Badge accent>self-reported</Badge>}
      >
        <div
          style={{
            display: "flex",
            gap: 20,
            flexWrap: "wrap",
            padding: "14px 16px",
            borderBottom: "1px solid var(--line)",
          }}
        >
          <div>
            <div className="num" style={{ fontSize: 22, fontWeight: 650, color: "var(--ac)" }}>
              {pct(dark)}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--tx2)" }}>
              dark social — no tracked link
            </div>
          </div>
          <div>
            <div className="num" style={{ fontSize: 22, fontWeight: 650 }}>
              {report.total.toLocaleString()}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--tx2)" }}>answers</div>
          </div>
          {report.reconciledCount >= 3 && (
            <div>
              <div
                className="num"
                style={{
                  fontSize: 22,
                  fontWeight: 650,
                  color: report.disagreeCount > 0 ? "var(--warn)" : "var(--ok)",
                }}
              >
                {pct(report.divergenceShare)}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--tx2)" }}>
                disagreed with the link
              </div>
            </div>
          )}
        </div>

        <div className="tblwrap">
          <table>
            <thead>
              <tr>
                <th>Source</th>
                <th style={{ textAlign: "right" }}>Answers</th>
                <th>Share</th>
              </tr>
            </thead>
            <tbody>
              {report.bySource.map((s) => (
                <tr key={s.source}>
                  <td>
                    <b>{s.label}</b>
                  </td>
                  <td className="num" style={{ textAlign: "right", fontWeight: 600 }}>
                    {s.count.toLocaleString()}
                  </td>
                  <td>
                    {pct(s.share)}
                    <div className="cbar">
                      <span style={{ width: `${Math.min(100, s.share * 100)}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {report.insight && (
        <Panel
          title="What LaunchWake sees — dark social"
          right={<Badge accent>insight</Badge>}
        >
          <div style={{ padding: "15px 16px", color: "var(--tx2)", lineHeight: 1.65 }}>
            {report.insight}
          </div>
        </Panel>
      )}
    </>
  );
}
