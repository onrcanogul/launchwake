import Link from "next/link";
import { StatStrip, type Stat } from "@/components/ui/StatStrip";
import { Panel } from "@/components/ui/Panel";
import { ShipTypeTag } from "@/components/ui/ShipTypeTag";
import { Button } from "@/components/ui/Button";
import { DemoCallout } from "@/components/demo/DemoCallout";
import { DEMO_FEED, DEMO_PROJECT } from "@/lib/demoData";

const STAT_ICONS = ["grid", "channels", "results", "results"] as const;

export default function DemoFeedPage() {
  const stats: Stat[] = DEMO_FEED.stats.map((s, i) => ({
    label: s.label,
    icon: STAT_ICONS[i],
    value: s.value,
  }));

  return (
    <>
      <div className="phead">
        <div>
          <h1 className="pg">{DEMO_PROJECT.name}</h1>
          <div className="psub">
            Every release, feature and post you ship — and what each one drove.
          </div>
        </div>
        <Button
          variant="primary"
          icon="plus"
          disabled
          title="Creating a ship needs a real account"
        >
          New ship
        </Button>
      </div>

      <DemoCallout icon="grid" title="Your workspace, one ship at a time">
        Each &ldquo;ship&rdquo; is something you released — a launch, a feature, a blog
        post. LaunchWake turns it into a distribution plan and then attributes the signups
        back. This demo is pre-filled with {DEMO_PROJECT.name}&rsquo;s launch so you can
        walk the whole flow.
      </DemoCallout>

      <StatStrip stats={stats} />

      <div style={{ marginTop: 20 }}>
        <Panel title="Recent ships">
          <div className="demo-feed-list">
            {DEMO_FEED.ships.map((s) => (
              <Link
                key={s.title}
                href="/demo/plan"
                className="demo-feed-row"
                style={{ textDecoration: "none" }}
              >
                <ShipTypeTag type={s.type} />
                <div>
                  <div className="t">{s.title}</div>
                  <div className="m">
                    {s.when} · {s.channels} channels
                  </div>
                </div>
                <div className="r">
                  <b>{s.signups}</b> signups
                </div>
              </Link>
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}
