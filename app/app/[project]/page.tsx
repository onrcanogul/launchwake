import Link from "next/link";
import { Suspense } from "react";
import { getWorkspace } from "@/lib/session";
import { LaunchRadar } from "@/components/dashboard/LaunchRadar";
import { getShipFeed, relativeTime } from "@/lib/ships";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { StatStrip, type Stat } from "@/components/ui/StatStrip";
import { EmptyState } from "@/components/ui/EmptyState";
import { Checklist, type ChecklistItem } from "@/components/ui/Checklist";
import { Badge } from "@/components/ui/Badge";
import { Note } from "@/components/ui/Note";
import { ShipTypeTag } from "@/components/ui/ShipTypeTag";

export default async function ShipFeedPage({
  params,
}: {
  params: Promise<{ project: string }>;
}) {
  const { project } = await params;
  const ws = await getWorkspace(project);

  const { ships, stats } = await getShipFeed(ws.project.id);

  const header = (
    <div className="phead">
      <div>
        <h1 className="pg">Ship feed</h1>
        <div className="psub">
          Every release, feature and post becomes a distribution moment.
          LaunchWake tells you where to take each one.
        </div>
      </div>
      <Button variant="primary" icon="plus" href={`/app/${project}/ships/new`}>
        New ship
      </Button>
    </div>
  );

  // ── Empty first-run state ──────────────────────────────
  if (ships.length === 0) {
    const checklist: ChecklistItem[] = [
      {
        title: "Connect your product",
        hint: ws.project.githubRepo
          ? `Connected · ${ws.project.githubRepo}`
          : "GitHub repo or product URL",
        done: Boolean(ws.project.githubRepo || ws.project.url),
      },
      {
        title: "Analyze your first ship",
        hint: "Get a real distribution plan",
        done: false,
      },
      { title: "Post it from your own account", hint: "We never auto-post", done: false },
      { title: "See what converted", hint: "Add the tracking pixel", done: false },
    ];

    return (
      <>
        {header}
        <EmptyState
          icon="grid"
          title="No ships yet"
          message="Connect GitHub or add your first ship — we'll show you where to take it, how to post without getting banned, and what drove signups."
          actions={
            <>
              <Button variant="primary" icon="plus" href={`/app/${project}/ships/new`}>
                Analyze first ship
              </Button>
              <Button variant="secondary" icon="github" href="/onboarding">
                Connect GitHub
              </Button>
            </>
          }
        />
        <div style={{ marginTop: 18 }}>
          <Panel title="Getting started">
            <Checklist items={checklist} />
          </Panel>
        </div>
      </>
    );
  }

  // ── Loaded state ───────────────────────────────────────
  const livePosts = ships.reduce((n, s) => n + s.postCount, 0);
  const statItems: Stat[] = [
    {
      label: "Clicks tracked",
      value: stats.clicks.toLocaleString(),
      detail:
        livePosts > 0
          ? `across ${livePosts} live post${livePosts === 1 ? "" : "s"}`
          : "tracked links report here",
    },
    {
      label: "Signups driven",
      value: stats.signups.toLocaleString(),
      detail: `from ${stats.shipsTotal} ship${stats.shipsTotal === 1 ? "" : "s"}`,
      detailUp: stats.signups > 0,
    },
    {
      label: "Ships distributed",
      value: (
        <>
          {stats.shipsDistributed}
          <small> / {stats.shipsTotal}</small>
        </>
      ),
      detail:
        stats.shipsNeedingPlan > 0
          ? `${stats.shipsNeedingPlan} need a plan`
          : "all planned",
    },
    {
      label: "Best channel",
      value: stats.bestChannel ?? "—",
      smallValue: true,
      detail: stats.bestChannel ? "by signups" : "post to see",
    },
  ];

  // Growth Mode, all caught up: nudge the next ship (the every-ship loop). The
  // manual route covers "paste your changelog" (its Describe/Paste-URL inputs).
  const caughtUp =
    ws.project.launchStage === "LAUNCHED" &&
    stats.shipsTotal > 0 &&
    stats.shipsNeedingPlan === 0 &&
    stats.shipsDistributed === stats.shipsTotal;

  return (
    <>
      {header}
      {caughtUp && (
        <Note icon="check" className="note-flow">
          You&apos;re all caught up — every ship is distributed. Shipped something
          new?{" "}
          <Link href={`/app/${project}/ships/new`}>
            Paste your changelog or create a ship
          </Link>{" "}
          to keep the momentum going.
        </Note>
      )}
      <StatStrip stats={statItems} />
      <Panel
        title="Recent ships"
        right={`${ships.length} ship${ships.length === 1 ? "" : "s"}`}
      >
        {ships.map((s) => (
          <Link key={s.id} href={`/app/${project}/ships/${s.id}/plan`} className="li">
            <div className="lft">
              <ShipTypeTag type={s.type} />
              <div>
                <div className="tt">
                  {s.title}
                  {s.autoDetected && (
                    <span className="tt-auto" title="Auto-detected from GitHub">
                      <Icon name="github" />
                    </span>
                  )}
                </div>
                <div className="st">
                  {relativeTime(s.detectedAt)} ·{" "}
                  {s.hasPlan
                    ? `${s.recCount} channels suggested`
                    : "not distributed yet"}
                </div>
              </div>
            </div>
            <div className="rgt">
              {ws.activeShip?.id === s.id && (
                <span className="badge ac">active</span>
              )}
              {s.hasPlan ? (
                s.signupCount > 0 ? (
                  <Badge dotColor="var(--ok)">{s.signupCount} signups</Badge>
                ) : (
                  <Badge>View plan →</Badge>
                )
              ) : (
                <Badge accent>Get plan →</Badge>
              )}
            </div>
          </Link>
        ))}
      </Panel>

      <Suspense fallback={<RadarFallback />}>
        <LaunchRadar project={ws.project} />
      </Suspense>
    </>
  );
}

function RadarFallback() {
  return (
    <Panel title="Launch radar" right="your category">
      <div
        style={{
          padding: "14px 16px",
          color: "var(--tx3)",
          fontSize: 12.5,
          display: "flex",
          alignItems: "center",
          gap: 9,
        }}
      >
        <span className="lw-spin" aria-hidden />
        Scanning Show HN and Reddit for launches in your space…
      </div>
    </Panel>
  );
}
