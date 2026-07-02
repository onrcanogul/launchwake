import { redirect } from "next/navigation";
import { getWorkspace } from "@/lib/session";
import { SelectShipPrompt } from "@/components/ship/SelectShipPrompt";

export default async function BareLaunchPage() {
  const ws = await getWorkspace();
  if (!ws.project) redirect("/onboarding");
  if (ws.activeShip) redirect(`/app/ships/${ws.activeShip.id}/launch`);

  return (
    <>
      <div className="phead">
        <div>
          <h1 className="pg">Launch day</h1>
          <div className="psub">Select a ship to see its launch run sheet.</div>
        </div>
      </div>
      <SelectShipPrompt ships={ws.ships} mode="launch" />
    </>
  );
}
