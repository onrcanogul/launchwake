import { Panel } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { getTrackingHealth, type HealthLevel } from "@/lib/trackingHealth";

const LEVEL_COLOR: Record<HealthLevel, string> = {
  green: "var(--ok)",
  amber: "var(--warn)",
  red: "var(--bad)",
};

const OVERALL_WORD: Record<HealthLevel, string> = {
  green: "All healthy",
  amber: "Needs setup",
  red: "Action needed",
};

/**
 * Loading skeleton for the tracking-health Panel (Suspense fallback). Keeps the
 * settings layout stable while the health queries run.
 */
export function TrackingHealthLoading() {
  return (
    <Panel title="Tracking health" right="checking…">
      {[0, 1, 2, 3].map((i) => (
        <div className="setrow" key={i}>
          <div className="l" style={{ flex: 1 }}>
            <div className="health-skel" style={{ width: "34%", marginBottom: 6 }} />
            <div className="health-skel" style={{ width: "62%" }} />
          </div>
        </div>
      ))}
    </Panel>
  );
}

/**
 * Async server section: fetches health, renders it, and degrades to a clear
 * error card if the check itself fails (so Settings never blanks out). Wrap in
 * <Suspense fallback={<TrackingHealthLoading />}> at the call site.
 */
export async function TrackingHealthSection({ projectId }: { projectId: string }) {
  let health;
  try {
    health = await getTrackingHealth(projectId);
  } catch {
    return (
      <Panel title="Tracking health" right={<Badge dotColor="var(--warn)">Unavailable</Badge>}>
        <div className="setrow">
          <div className="l">
            <b>Couldn&apos;t load tracking health</b>
            <span>
              We hit a snag reading your ingestion status. Refresh in a moment — if
              it persists, your attribution data is unaffected.
            </span>
          </div>
        </div>
      </Panel>
    );
  }

  return (
    <Panel
      title="Tracking health"
      right={<Badge dotColor={LEVEL_COLOR[health.overall]}>{OVERALL_WORD[health.overall]}</Badge>}
    >
      <div style={{ padding: "10px 16px", color: "var(--tx3)", fontSize: 11.5, borderBottom: "1px solid var(--line)" }}>
        Green means data is flowing. Amber and red show exactly where to look, so
        missing numbers never get mistaken for a channel that didn&apos;t work.
      </div>
      {health.items.map((item) => (
        <div className="setrow health-row" key={item.key}>
          <div className="l">
            <b>{item.label}</b>
            <span>{item.detail}</span>
            {item.fix && <span className="fix">{item.fix}</span>}
          </div>
          <Badge dotColor={LEVEL_COLOR[item.level]}>{item.status}</Badge>
        </div>
      ))}
    </Panel>
  );
}
