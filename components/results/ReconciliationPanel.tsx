import { Panel } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import type { ConfidenceLevel, ReconciliationView } from "@/lib/selfReport";

function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

const CONFIDENCE: Record<ConfidenceLevel, { color: string; note: string }> = {
  HIGH: { color: "var(--ok)", note: "tracked + reported agree" },
  MEDIUM: { color: "var(--warn)", note: "one source only" },
  LOW: { color: "var(--tx3)", note: "small sample" },
};

/** A count with its source label — tracked and reported get visually distinct chips. */
function SignalCell({ value, kind }: { value: number; kind: "tracked" | "reported" }) {
  if (value === 0) return <span style={{ color: "var(--tx3)" }}>—</span>;
  const color = kind === "tracked" ? "var(--ac)" : "var(--tx2)";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <b className="num" style={{ color, fontWeight: 650 }}>{value.toLocaleString()}</b>
      <span
        className="badge"
        style={{ fontSize: 10, color: "var(--tx3)", textTransform: "uppercase", letterSpacing: 0.3 }}
      >
        {kind}
      </span>
    </span>
  );
}

/**
 * The honest blended view: per source, TRACKED (Events, verifiable) and REPORTED
 * (survey, self-reported) signups shown side by side with a confidence label — we
 * never merge them into one "exact" number. Plus the dark-social/unknown bucket,
 * with a factual explainer so a big untracked slice reads as normal, not broken.
 */
export function ReconciliationPanel({ view }: { view: ReconciliationView }) {
  const { channels, darkSocial } = view;
  if (channels.length === 0 && darkSocial.total === 0) return null;

  return (
    <Panel title="Where signups come from" right={<Badge accent>tracked + reported</Badge>}>
      <div style={{ padding: "10px 16px", color: "var(--tx3)", fontSize: 11.5, borderBottom: "1px solid var(--line)" }}>
        Two independent signals, side by side — never merged into one number.{" "}
        <b style={{ color: "var(--ac)" }}>Tracked</b> is what a link recorded (verifiable);{" "}
        <b style={{ color: "var(--tx2)" }}>reported</b> is what people said in the survey.
        Confidence is highest when both agree.
      </div>

      <div className="tblwrap">
        <table>
          <thead>
            <tr>
              <th>Source</th>
              <th style={{ textAlign: "right" }}>Tracked</th>
              <th style={{ textAlign: "right" }}>Reported</th>
              <th>Confidence</th>
            </tr>
          </thead>
          <tbody>
            {channels.map((c) => (
              <tr key={c.platform}>
                <td>
                  <b>{c.label}</b>
                </td>
                <td style={{ textAlign: "right" }}>
                  <SignalCell value={c.trackedSignups} kind="tracked" />
                </td>
                <td style={{ textAlign: "right" }}>
                  <SignalCell value={c.reportedSignups} kind="reported" />
                </td>
                <td>
                  <Badge dotColor={CONFIDENCE[c.confidence].color}>{c.confidence}</Badge>
                  <span style={{ marginLeft: 8, color: "var(--tx3)", fontSize: 11 }}>
                    {CONFIDENCE[c.confidence].note}
                  </span>
                </td>
              </tr>
            ))}

            {darkSocial.total > 0 && (
              <tr style={{ background: "var(--bg2, transparent)" }}>
                <td>
                  <b>Dark social / unknown</b>
                  {darkSocial.topSource && (
                    <span style={{ color: "var(--tx3)", fontSize: 11, marginLeft: 6 }}>
                      top: {darkSocial.topSource.label}
                    </span>
                  )}
                </td>
                <td style={{ textAlign: "right" }}>
                  <SignalCell value={darkSocial.trackedSignups} kind="tracked" />
                </td>
                <td style={{ textAlign: "right" }}>
                  <SignalCell value={darkSocial.reportedSignups} kind="reported" />
                </td>
                <td style={{ color: "var(--tx2)", fontSize: 12 }}>
                  {pct(darkSocial.reportedShare)} of survey answers
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {darkSocial.total > 0 && (
        <div style={{ padding: "12px 16px", color: "var(--tx2)", fontSize: 12, lineHeight: 1.6, borderTop: "1px solid var(--line)" }}>
          {darkSocial.explainer}
        </div>
      )}
    </Panel>
  );
}
