import Link from "next/link";
import { Panel } from "@/components/ui/Panel";
import { Icon } from "@/components/Icon";
import { platformIcon } from "@/components/ui/platform";
import { RISK, type BanRiskValue } from "@/components/ui/risk";
import { DemoCallout } from "@/components/demo/DemoCallout";
import { DEMO_CHANNELS, DEMO_CHANNEL_TOTAL } from "@/lib/demoData";

export default function DemoChannelsPage() {
  return (
    <>
      <div className="phead">
        <div>
          <h1 className="pg">Channels</h1>
          <div className="psub">
            The vetted catalog — every venue with its real rules, ban risk, and how it
            performs for products like yours.
          </div>
        </div>
      </div>

      <DemoCallout icon="channels" title="A catalog, not a guess">
        LaunchWake ships {DEMO_CHANNEL_TOTAL}+ real communities with their actual posting
        rules and account requirements. Plans can only recommend from this list — so you
        never get sent to a made-up subreddit that gets you banned.
      </DemoCallout>

      <Panel>
        <div className="demo-tablewrap">
          <table className="demo-table">
            <thead>
              <tr>
                <th>Channel</th>
                <th>Audience</th>
                <th className="num">Fit</th>
                <th>Ban risk</th>
                <th>Best time</th>
                <th className="num">Median signups</th>
              </tr>
            </thead>
            <tbody>
              {DEMO_CHANNELS.map((c) => {
                const risk = RISK[c.banRisk as BanRiskValue];
                return (
                  <tr key={c.name}>
                    <td>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                        <Icon
                          name={platformIcon(c.platform)}
                          style={{ width: 15, height: 15, stroke: "var(--tx3)", strokeWidth: 1.6, fill: "none" }}
                        />
                        <b>{c.name}</b>
                      </span>
                    </td>
                    <td>{c.audience}</td>
                    <td className="num">
                      <b>{c.fitScore}</b>
                    </td>
                    <td>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <span
                          className="dot"
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: "50%",
                            background: risk.color,
                            display: "inline-block",
                          }}
                        />
                        {risk.label}
                      </span>
                    </td>
                    <td>{c.bestTime}</td>
                    <td className="num">
                      <b>{c.medianSignups}</b>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="demo-lock">
        <Icon name="lock" />
        <span>
          Median-signups benchmarks by category are a Pro feature —{" "}
          <Link href="/login?callbackUrl=%2Fonboarding">start free</Link> to see how your product
          type performs on each channel.
        </span>
      </div>
    </>
  );
}
