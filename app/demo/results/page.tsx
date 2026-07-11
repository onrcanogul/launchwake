import Link from "next/link";
import { RoiStrip } from "@/components/results/RoiStrip";
import { SelfReportPanel } from "@/components/results/SelfReportPanel";
import { Panel } from "@/components/ui/Panel";
import { Icon } from "@/components/Icon";
import { formatMoney } from "@/lib/attribution";
import { DemoCallout } from "@/components/demo/DemoCallout";
import { DEMO_RESULTS, DEMO_SELF_REPORT } from "@/lib/demoData";

export default function DemoResultsPage() {
  const r = DEMO_RESULTS;
  return (
    <>
      <div className="phead">
        <div>
          <h1 className="pg">Results</h1>
          <div className="psub">
            What each channel actually drove — clicks, signups, and real revenue, not
            vanity metrics.
          </div>
        </div>
      </div>

      <DemoCallout icon="results" title="The payoff: what actually drove signups">
        LaunchWake mints a tracked link per post, then ties every signup — and every dollar
        — back to the channel that earned it. It also reconciles what people <i>say</i> in a
        one-question survey, so word-of-mouth that no UTM can see still shows up.
      </DemoCallout>

      <RoiStrip roi={r.roi} topRevenueChannel={r.topRevenueChannel} />

      <div style={{ marginTop: 20 }}>
        <Panel title="By channel">
          <div className="demo-tablewrap">
            <table className="demo-table">
              <thead>
                <tr>
                  <th>Channel</th>
                  <th className="num">Clicks</th>
                  <th className="num">Signups</th>
                  <th className="num">Conv.</th>
                  <th className="num">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {r.perChannel.map((c) => (
                  <tr key={c.channelName}>
                    <td>
                      <b>{c.channelName}</b>
                    </td>
                    <td className="num">{c.clicks.toLocaleString()}</td>
                    <td className="num">
                      <b>{c.signups}</b>
                    </td>
                    <td className="num">{Math.round(c.conversion * 100)}%</td>
                    <td className="num">
                      {c.revenueCents > 0 ? (
                        <b style={{ color: "var(--ac)" }}>
                          {formatMoney(c.revenueCents, r.currency)}
                        </b>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <div style={{ marginTop: 20 }}>
        <SelfReportPanel report={DEMO_SELF_REPORT} />
      </div>

      <div className="demo-lock">
        <Icon name="lock" />
        <span>
          Connect Stripe (or the revenue API) and drop in the one-line pixel to see this
          for your own launch.{" "}
          <Link href="/login?callbackUrl=%2Fonboarding">Start free</Link>.
        </span>
      </div>
    </>
  );
}
