import { redirect } from "next/navigation";
import { getWorkspace, displayName, projectSubtitle } from "@/lib/session";
import { AppShell } from "@/components/shell/AppShell";
import { SelectShipPrompt } from "@/components/ship/SelectShipPrompt";

export default async function BarePlanPage() {
  const ws = await getWorkspace();
  if (!ws.project) redirect("/onboarding");
  if (ws.activeShip) redirect(`/app/ships/${ws.activeShip.id}/plan`);

  return (
    <AppShell
      project={{ name: ws.project.name, subtitle: projectSubtitle(ws.project) }}
      user={{ name: displayName(ws.user), plan: ws.user.plan }}
      ships={ws.ships}
      activeShip={null}
      channelsCount={ws.channelsCount}
      crumb="Where to post"
    >
      <div className="phead">
        <div>
          <h1 className="pg">Where to post</h1>
          <div className="psub">
            Select a ship to see its distribution plan.
          </div>
        </div>
      </div>
      <SelectShipPrompt ships={ws.ships} mode="plan" />
    </AppShell>
  );
}
