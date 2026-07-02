import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
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
import { ShipTypeTag } from "@/components/ui/ShipTypeTag";

export default async function ShipFeedPage() {
  const ws = await getWorkspace();
  if (!ws.project) redirect("/onboarding");

  const { ships, stats } = await getShipFeed(ws.project.id);

  const shell = (children: React.ReactNode) => <>{children}</>;

  const header = (
    <div className="phead">
      <div>
        <h1 className="pg">Ship feed</h1>
        <div className="psub">
          Every release, feature and post becomes a distribution moment.
          LaunchWake tells you where to take each one.
        </div>
      </div>
      <Button variant="primary" icon="plus" href="/app/ships/new">
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

    return shell(
      <>
        {header}
        <EmptyState
          icon="grid"
          title="No ships yet"
          message="Connect GitHub or add your first ship — we'll show you where to take it, how to post without getting banned, and what drove signups."
          actions={
            <>
              <Button variant="primary" icon="plus" href="/app/ships/new">
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
      </>,
    );
  }

  // ── Loaded state ───────────────────────────────────────
  const statItems: Stat[] = [
    {
      label: "Clicks tracked",
      value: stats.clicks.toLocaleString(),
      detail:
        stats.shipsNeedingPlan > 0
          ? `${stats.shipsNeedingPlan} ship${stats.shipsNeedingPlan === 1 ? "" : "s"} need a plan`
          : "all ships planned",
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

  return shell(
    <>
      {header}
      <StatStrip stats={statItems} />
      <Panel title="Recent ships" right={`${ships.length} total`}>
        {ships.map((s) => (
          <Link
            key={s.id}
            href={`/app/ships/${s.id}/plan`}
            className="li"
            style={{ color: "inherit" }}
          >
            <div className="lft">
              <ShipTypeTag type={s.type} />
              <div>
                <div className="tt">
                  {s.title}
                  {s.autoDetected && (
                    <span
                      title="Auto-detected from GitHub"
                      style={{
                        display: "inline-flex",
                        verticalAlign: "middle",
                        marginLeft: 7,
                        color: "var(--tx3)",
                      }}
                    >
                      <Icon
                        name="github"
                        style={{
                          width: 12,
                          height: 12,
                          fill: "currentColor",
                          stroke: "none",
                        }}
                      />
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
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
    </>,
  );
}

function RadarFallback() {
  return (
    <Panel title="Launch radar" right="your category">
      <div style={{ padding: "16px", color: "var(--tx3)", fontSize: 12.5 }}>
        Scanning Show HN and Reddit for launches in your space…
      </div>
    </Panel>
  );
}
