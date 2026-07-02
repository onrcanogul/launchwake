import { redirect } from "next/navigation";
import { getWorkspace } from "@/lib/session";
import { SelectShipPrompt } from "@/components/ship/SelectShipPrompt";

export default async function BarePitchesPage() {
  const ws = await getWorkspace();
  if (!ws.project) redirect("/onboarding");
  if (ws.activeShip) redirect(`/app/ships/${ws.activeShip.id}/pitches`);

  return (
    <>
      <div className="phead">
        <div>
          <h1 className="pg">Newsletter pitches</h1>
          <div className="psub">Select a ship to pitch newsletters for it.</div>
        </div>
      </div>
      <SelectShipPrompt ships={ws.ships} mode="pitches" />
    </>
  );
}
