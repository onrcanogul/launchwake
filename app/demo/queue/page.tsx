import Link from "next/link";
import { Panel } from "@/components/ui/Panel";
import { Icon } from "@/components/Icon";
import { DemoCallout } from "@/components/demo/DemoCallout";

const PHASES = [
  {
    phase: "Launch day",
    tasks: [
      { done: true, text: "Post to Show HN (link in first comment)", when: "Tue 8:00am ET" },
      { done: true, text: "Ship on Product Hunt", when: "Tue 12:01am PT" },
      { done: false, text: "Share in r/devops weekly thread", when: "Tue 9:30am ET" },
    ],
  },
  {
    phase: "Day 2–3",
    tasks: [
      { done: false, text: "Submit the design write-up to Lobsters", when: "Wed" },
      { done: false, text: "Post the build-in-public TikTok", when: "Wed 7:00pm" },
    ],
  },
  {
    phase: "Week 1",
    tasks: [
      { done: false, text: "Reply to every HN + PH comment", when: "ongoing" },
      { done: false, text: "Send the launch to your newsletter", when: "Thu" },
    ],
  },
];

export default function DemoQueuePage() {
  return (
    <>
      <div className="phead">
        <div>
          <h1 className="pg">Queue</h1>
          <div className="psub">
            A paced cadence so you don&rsquo;t dump everything on day one and burn the
            channels that matter most.
          </div>
        </div>
      </div>

      <DemoCallout icon="calendar" title="Space it out, don't spray it">
        LaunchWake turns your plan into a phased schedule — the right channel at the right
        time — so each post lands when its community is active and you&rsquo;re not
        spreading yourself thin.
      </DemoCallout>

      <div className="demo-kit">
        {PHASES.map((p) => (
          <Panel key={p.phase} title={p.phase}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {p.tasks.map((t) => (
                <div
                  key={t.text}
                  className="demo-feed-row"
                  style={{ padding: "11px 4px" }}
                >
                  <span
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      flex: "none",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: `1px solid ${t.done ? "var(--ac)" : "var(--line2)"}`,
                      background: t.done ? "var(--acd)" : "transparent",
                    }}
                  >
                    {t.done && (
                      <Icon
                        name="check"
                        style={{ width: 11, height: 11, stroke: "var(--ac)", strokeWidth: 2, fill: "none" }}
                      />
                    )}
                  </span>
                  <div>
                    <div
                      className="t"
                      style={{
                        color: t.done ? "var(--tx3)" : "var(--tx)",
                        textDecoration: t.done ? "line-through" : "none",
                      }}
                    >
                      {t.text}
                    </div>
                  </div>
                  <div className="r">{t.when}</div>
                </div>
              ))}
            </div>
          </Panel>
        ))}
      </div>

      <div className="demo-lock">
        <Icon name="lock" />
        <span>
          In your account you can check tasks off, snooze them, and get an email or Slack
          nudge at the best time. <Link href="/login?callbackUrl=%2Fonboarding">Start free</Link>.
        </span>
      </div>
    </>
  );
}
