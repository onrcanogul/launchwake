import Link from "next/link";
import { Panel } from "@/components/ui/Panel";
import { Note } from "@/components/ui/Note";
import { Icon } from "@/components/Icon";
import { DemoCallout } from "@/components/demo/DemoCallout";

const PITCHES = [
  {
    curator: "Console.dev",
    audience: "~40k developers · tools newsletter",
    body: `Subject: Cascade — zero-lock database migrations (open source)\n\nHi — Cascade runs Postgres/MySQL schema changes in the background and swaps them in without an exclusive lock, even on tables with millions of rows. It's MIT-licensed and installs as a single binary. Thought it might fit Console's tools section — happy to send a short demo.`,
  },
  {
    curator: "TLDR Web Dev",
    audience: "~1M subscribers · daily dev digest",
    body: `Subject: Migrations that never lock a table\n\nCascade 1.0 is out: online schema changes with zero downtime, open-source, Postgres + MySQL. The launch write-up covers the background-copy + atomic-swap approach. One-line summary and a link below if it's a fit for TLDR.`,
  },
];

export default function DemoPitchesPage() {
  return (
    <>
      <div className="phead">
        <div>
          <h1 className="pg">Newsletters</h1>
          <div className="psub">
            A tailored pitch for each relevant curator — the outreach most founders skip
            because it&rsquo;s tedious.
          </div>
        </div>
      </div>

      <DemoCallout icon="mail" title="Get covered, not just posted">
        LaunchWake finds newsletters whose audience matches your product and drafts a short,
        specific pitch for each curator — the kind that actually gets a reply. You send it;
        LaunchWake never emails on your behalf.
      </DemoCallout>

      <div className="demo-kit">
        {PITCHES.map((p) => (
          <Panel
            key={p.curator}
            title={p.curator}
            right={<span style={{ fontSize: 11.5, color: "var(--tx3)" }}>{p.audience}</span>}
          >
            <pre className="demo-draftbody">{p.body}</pre>
            <Note icon="mail">
              Send from your own inbox and follow the curator&rsquo;s submission guidelines —
              a personal note beats a form every time.
            </Note>
          </Panel>
        ))}
      </div>

      <div className="demo-lock">
        <Icon name="lock" />
        <span>
          In your account, LaunchWake matches curators to your product and regenerates any
          pitch. <Link href="/login?callbackUrl=%2Fonboarding">Start free</Link>.
        </span>
      </div>
    </>
  );
}
