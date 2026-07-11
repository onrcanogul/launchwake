import Link from "next/link";
import { RoiStrip } from "@/components/results/RoiStrip";
import { Panel } from "@/components/ui/Panel";
import { Icon } from "@/components/Icon";
import { DemoCallout } from "@/components/demo/DemoCallout";
import { DEMO_RESULTS } from "@/lib/demoData";

const RUN_SHEET = [
  { time: "12:01am PT", channel: "Product Hunt", action: "Ship the launch, reply to first comments", done: true },
  { time: "8:00am ET", channel: "Show HN", action: "Post; drop the GitHub link in the first comment", done: true },
  { time: "9:30am ET", channel: "r/devops", action: "Share the failure story in the weekly thread", done: false },
  { time: "7:00pm", channel: "TikTok", action: "Post the build-in-public clip", done: false },
];

export default function DemoLaunchPage() {
  return (
    <>
      <div className="phead">
        <div>
          <h1 className="pg">Launch day</h1>
          <div className="psub">
            A time-ordered run sheet plus the live ROI — everything in one place while it
            matters most.
          </div>
        </div>
      </div>

      <DemoCallout icon="rocket" title="Run the day from one screen">
        Launch day is a cockpit: the exact order to post, a place to paste each live URL,
        and the ROI updating as clicks and signups land. No spreadsheet, no guessing what&rsquo;s
        next.
      </DemoCallout>

      <RoiStrip roi={DEMO_RESULTS.roi} topRevenueChannel={DEMO_RESULTS.topRevenueChannel} />

      <div style={{ marginTop: 20 }}>
        <Panel title="Run sheet">
          <div style={{ display: "flex", flexDirection: "column" }}>
            {RUN_SHEET.map((s) => (
              <div key={s.channel} className="demo-feed-row" style={{ padding: "12px 4px" }}>
                <span
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    flex: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: `1px solid ${s.done ? "var(--ac)" : "var(--line2)"}`,
                    background: s.done ? "var(--acd)" : "transparent",
                  }}
                >
                  {s.done && (
                    <Icon name="check" style={{ width: 11, height: 11, stroke: "var(--ac)", strokeWidth: 2, fill: "none" }} />
                  )}
                </span>
                <div>
                  <div className="t">{s.channel}</div>
                  <div className="m">{s.action}</div>
                </div>
                <div className="r">{s.time}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="demo-lock">
        <Icon name="lock" />
        <span>
          Your account tracks each post live and can publish a shareable launch report when
          the dust settles. <Link href="/login?callbackUrl=%2Fonboarding">Start free</Link>.
        </span>
      </div>
    </>
  );
}
