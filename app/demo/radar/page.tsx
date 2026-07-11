import Link from "next/link";
import { Icon } from "@/components/Icon";
import { platformIcon } from "@/components/ui/platform";
import { DemoCallout } from "@/components/demo/DemoCallout";

const MATCHES = [
  {
    platform: "HACKERNEWS",
    where: "Hacker News · Ask HN",
    title: "Ask HN: how do you run big Postgres migrations without downtime?",
    snippet:
      "We're at ~30M rows and every ALTER locks the table long enough to page someone. What are teams actually doing here?",
    age: "3h ago",
    fit: "Strong match",
  },
  {
    platform: "REDDIT",
    where: "r/devops",
    title: "Migration locked prod for 11 minutes last night",
    snippet:
      "Postmortem incoming. Looking for tools that do online schema changes — pt-online-schema-change felt heavy.",
    age: "yesterday",
    fit: "Strong match",
  },
  {
    platform: "REDDIT",
    where: "r/PostgreSQL",
    title: "Zero-downtime column type change on a huge table?",
    snippet:
      "Need to change an int to bigint on a 50M-row table. Shadow table + backfill + swap seems right but scary.",
    age: "2d ago",
    fit: "Good match",
  },
];

export default function DemoRadarPage() {
  return (
    <>
      <div className="phead">
        <div>
          <h1 className="pg">Intent Radar</h1>
          <div className="psub">
            People asking, right now, for exactly what you built — so you can help (and be
            found) before a competitor does.
          </div>
        </div>
      </div>

      <DemoCallout icon="target" title="Catch demand as it happens">
        Intent Radar watches communities for people describing the problem your product
        solves. Reply with genuine help — not a pitch — and you reach buyers at the exact
        moment they&rsquo;re looking.
      </DemoCallout>

      <div className="demo-cards">
        {MATCHES.map((m) => (
          <div className="demo-card" key={m.title}>
            <div className="demo-card-hd">
              <Icon
                name={platformIcon(m.platform)}
                style={{ width: 16, height: 16, stroke: "var(--tx2)", strokeWidth: 1.6, fill: "none" }}
              />
              {m.where}
              <span className="demo-pill">{m.fit}</span>
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 550, color: "var(--tx)", marginTop: 8 }}>
              {m.title}
            </div>
            <div className="demo-card-body">{m.snippet}</div>
            <div className="demo-card-meta">
              <span>{m.age}</span>
              <span>
                <b>Draft a helpful reply</b> · in your account
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="demo-lock">
        <Icon name="lock" />
        <span>
          Intent Radar is a Pro feature — LaunchWake drafts a genuinely-helpful reply for
          each match. <Link href="/login?callbackUrl=%2Fonboarding">Start free</Link>.
        </span>
      </div>
    </>
  );
}
