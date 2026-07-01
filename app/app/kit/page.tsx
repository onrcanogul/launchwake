import { redirect } from "next/navigation";
import { getWorkspace, displayName, projectSubtitle } from "@/lib/session";
import { AppShell } from "@/components/shell/AppShell";
import { SelectShipPrompt } from "@/components/ship/SelectShipPrompt";

export default async function BareKitPage() {
  const ws = await getWorkspace();
  if (!ws.project) redirect("/onboarding");
  if (ws.activeShip) redirect(`/app/ships/${ws.activeShip.id}/kit`);

  return (
    <AppShell
      project={{ name: ws.project.name, subtitle: projectSubtitle(ws.project) }}
      user={{ name: displayName(ws.user), plan: ws.user.plan }}
      ships={ws.ships}
      activeShip={null}
      channelsCount={ws.channelsCount}
      crumb="Launch kit"
    >
      <div className="phead">
        <div>
          <h1 className="pg">Launch kit</h1>
          <div className="psub">Select a ship to see its drafts.</div>
        </div>
      </div>
      <SelectShipPrompt ships={ws.ships} mode="kit" />
    </AppShell>
  );
}
