import Link from "next/link";
import { Panel } from "@/components/ui/Panel";
import { Note } from "@/components/ui/Note";
import { Icon } from "@/components/Icon";
import { platformIcon } from "@/components/ui/platform";
import { DemoCallout } from "@/components/demo/DemoCallout";
import { DEMO_KIT } from "@/lib/demoData";

export default function DemoKitPage() {
  return (
    <>
      <div className="phead">
        <div>
          <h1 className="pg">Launch kit</h1>
          <div className="psub">
            A platform-native draft for every channel — written to that community&rsquo;s
            rules, with the ban-safety note baked in.
          </div>
        </div>
      </div>

      <DemoCallout icon="kit" title="How to post it — without getting banned">
        Each draft is written for its channel: a build-story for Show HN, a problem-first
        post for r/devops, a shootable video concept for TikTok. The safety note tells you
        the one thing that gets posts removed. LaunchWake never posts for you — you stay in
        control.
      </DemoCallout>

      <div className="demo-kit">
        {DEMO_KIT.recs.map((rec) => (
          <Panel
            key={rec.id}
            title={
              <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
                <Icon
                  name={platformIcon(rec.platform)}
                  style={{ width: 16, height: 16, stroke: "var(--tx2)", strokeWidth: 1.6, fill: "none" }}
                />
                {rec.channelName}
              </span>
            }
            right={rec.bestTime ? <span style={{ fontSize: 11.5, color: "var(--tx3)" }}>Best · {rec.bestTime}</span> : undefined}
          >
            {rec.draft && (
              <>
                {rec.shortform && rec.draft.storyboard ? (
                  <>
                    <p className="demo-draftbody">{rec.draft.storyboard.hook}</p>
                    <ul className="demo-story">
                      {rec.draft.storyboard.beats.map((b, i) => (
                        <li key={i}>
                          <b>{b.label}</b>
                          <span>{b.detail}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <pre className="demo-draftbody">{rec.draft.body}</pre>
                )}
                {rec.draft.safetyNote && <Note icon="shield">{rec.draft.safetyNote}</Note>}
              </>
            )}
          </Panel>
        ))}
      </div>

      <div className="demo-lock">
        <Icon name="kit" />
        <span>
          In your own account you can edit every draft, regenerate with a different tone,
          and mint a tracked link per post.{" "}
          <Link href="/login?callbackUrl=%2Fonboarding">Start free</Link>.
        </span>
      </div>
    </>
  );
}
