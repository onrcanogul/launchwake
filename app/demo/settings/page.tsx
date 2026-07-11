import Link from "next/link";
import { Panel } from "@/components/ui/Panel";
import { Icon } from "@/components/Icon";
import { Badge } from "@/components/ui/Badge";
import { DemoCallout } from "@/components/demo/DemoCallout";

const SECTIONS = [
  { icon: "github", title: "GitHub", desc: "Connect a repo so new releases become ships automatically." },
  { icon: "results", title: "Attribution", desc: "Drop in a one-line pixel and connect Stripe to attribute signups and revenue." },
  { icon: "mail", title: "Emails", desc: "Choose which launch reminders and digests you receive." },
  { icon: "settings", title: "Billing", desc: "Free covers 1 project and 2 plans a month; Pro unlocks benchmarks, Radar and more." },
  { icon: "channels", title: "Team & white-label", desc: "Invite teammates and put your own brand on client reports (Team plan)." },
] as const;

export default function DemoSettingsPage() {
  return (
    <>
      <div className="phead">
        <div>
          <h1 className="pg">Settings</h1>
          <div className="psub">Connections, attribution, billing and team — for your real workspace.</div>
        </div>
      </div>

      <DemoCallout icon="settings" title="Where you wire it to reality">
        This is the one screen the demo keeps read-only: connecting GitHub, Stripe and your
        pixel is what turns the plan into tracked, attributed results. Create a free account
        to set it up for your product.
      </DemoCallout>

      <div className="demo-kit">
        {SECTIONS.map((s) => (
          <Panel
            key={s.title}
            title={
              <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
                <Icon name={s.icon} style={{ width: 16, height: 16, stroke: "var(--tx2)", strokeWidth: 1.6, fill: "none" }} />
                {s.title}
              </span>
            }
            right={<Badge>demo</Badge>}
          >
            <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 14 }}>
              <p style={{ fontSize: 12.5, color: "var(--tx2)", lineHeight: 1.55, margin: 0, flex: 1 }}>
                {s.desc}
              </p>
              <button className="btn btn-s" disabled style={{ opacity: 0.55, cursor: "not-allowed", flex: "none" }}>
                Configure
              </button>
            </div>
          </Panel>
        ))}
      </div>

      <div className="demo-lock">
        <Icon name="lock" />
        <span>
          Settings are disabled in the demo. <Link href="/login?callbackUrl=%2Fonboarding">Start free</Link> to connect your own tools.
        </span>
      </div>
    </>
  );
}
