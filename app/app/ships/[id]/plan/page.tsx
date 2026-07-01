import { notFound, redirect } from "next/navigation";
import { getWorkspace, displayName, projectSubtitle } from "@/lib/session";
import { getShipWithPlan } from "@/lib/plans";
import { AppShell } from "@/components/shell/AppShell";
import { ChannelCard } from "@/components/channel/ChannelCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { RerunButton } from "@/components/ship/RerunButton";

export default async function PlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ws = await getWorkspace();
  if (!ws.project) redirect("/onboarding");

  const data = await getShipWithPlan(id, ws.user.id);
  if (!data) notFound();

  const { ship, recs } = data;

  return (
    <AppShell
      project={{
        name: ws.project.name,
        subtitle: projectSubtitle(ws.project),
      }}
      user={{ name: displayName(ws.user), plan: ws.user.plan }}
      shipNav={{ id: ship.id, title: ship.title }}
      channelsCount={ws.channelsCount}
      crumb="Where to post"
    >
      <div className="phead">
        <div>
          <h1 className="pg">Where to post</h1>
          <div className="psub">
            Distribution plan for{" "}
            <b style={{ color: "var(--tx)" }}>&ldquo;{ship.title}&rdquo;</b> —{" "}
            {recs.length} channel{recs.length === 1 ? "" : "s"} ranked by fit, with
            rules and the safe way in.
          </div>
        </div>
        {recs.length > 0 && <RerunButton shipId={ship.id} />}
      </div>

      {recs.length === 0 ? (
        <EmptyState
          icon="where"
          title="No plan yet"
          message="We couldn't find a distribution plan for this ship. Build one to see where its audience gathers."
          actions={
            <Button variant="primary" icon="target" href="/app/ships/new">
              Build a plan
            </Button>
          }
        />
      ) : (
        recs.map((rec) => (
          <ChannelCard
            key={rec.id}
            data={{
              name: rec.channelName,
              platform: rec.platform,
              audienceDesc: rec.audienceDesc,
              fitScore: rec.fitScore,
              banRisk: rec.banRisk,
              bestTime: rec.bestTime,
              whyText: rec.whyText,
              ruleNote: rec.ruleNote,
            }}
            draftHref={`/app/ships/${ship.id}/kit?rec=${rec.id}`}
          />
        ))
      )}
    </AppShell>
  );
}
