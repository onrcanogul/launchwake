import { relativeTime } from "@/lib/ships";
import type { HealthRow, HealthTone } from "@/lib/trackingHealth";

const DOT: Record<HealthTone, string> = {
  ok: "var(--ok)",
  warn: "var(--warn)",
  idle: "var(--tx3)",
};
const TAG: Record<HealthTone, string> = { ok: "OK", warn: "Check", idle: "—" };

/**
 * At-a-glance tracking health: is data flowing, and did any webhook fail? Purely
 * presentational — the rows are composed by lib/trackingHealth (unit-tested).
 */
export function TrackingHealth({ rows }: { rows: HealthRow[] }) {
  return (
    <>
      {rows.map((r) => (
        <div className="setrow" key={r.key}>
          <div className="l">
            <b>{r.label}</b>
            <span>
              {r.detail}
              {r.at ? ` · last ${relativeTime(new Date(r.at))}` : ""}
              {r.error ? ` — ${r.error}` : ""}
            </span>
          </div>
          <span className="badge">
            <span className="dot" style={{ background: DOT[r.tone] }} aria-hidden />
            {TAG[r.tone]}
          </span>
        </div>
      ))}
    </>
  );
}
