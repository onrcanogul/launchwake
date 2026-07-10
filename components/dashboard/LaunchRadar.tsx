import { Panel } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { Icon, type IconName } from "@/components/Icon";
import { relativeTime } from "@/lib/ships";
import { getLaunchRadar, type RadarSource } from "@/lib/radar";
import type { ClassifiableProject } from "@/lib/projectTags";

const SOURCE: Record<RadarSource, { icon: IconName; label: string }> = {
  HN: { icon: "hn", label: "Show HN" },
  REDDIT: { icon: "reddit", label: "Reddit" },
  PRODUCTHUNT: { icon: "target", label: "Product Hunt" },
};

/**
 * Async server component (stream it behind Suspense): peers/competitors that
 * launched in this product's category this week, so the founder can borrow the
 * angles that worked.
 */
export async function LaunchRadar({
  project,
}: {
  project: ClassifiableProject;
}) {
  const items = await getLaunchRadar(project);

  if (items.length === 0) {
    return (
      <Panel title="Launch radar" right="your category">
        <div style={{ padding: "16px", color: "var(--tx3)", fontSize: 12.5 }}>
          Nothing notable launched in your space this week — or we couldn&apos;t
          reach the sources. Check back; the radar refreshes hourly.
        </div>
      </Panel>
    );
  }

  return (
    <Panel title="Launch radar" right={<Badge accent>this week · {items.length}</Badge>}>
      <div style={{ padding: "4px 0" }}>
        {items.map((it) => {
          const src = SOURCE[it.source];
          return (
            <a
              key={it.url}
              href={it.url}
              target="_blank"
              rel="noopener noreferrer"
              className="radar-row"
            >
              <span className="radar-src">
                <Icon name={src.icon} />
              </span>
              <span className="radar-main">
                <span className="radar-title">{it.title}</span>
                {it.angle && <span className="radar-angle">“{it.angle}”</span>}
              </span>
              <span className="radar-meta">
                <b className="num">{it.points.toLocaleString()}</b> pts
                <span className="radar-when">{relativeTime(it.at)}</span>
              </span>
            </a>
          );
        })}
      </div>
    </Panel>
  );
}
