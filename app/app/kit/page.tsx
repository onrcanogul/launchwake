import { redirect } from "next/navigation";
import { getWorkspace } from "@/lib/session";
import { SelectShipPrompt } from "@/components/ship/SelectShipPrompt";

export default async function BareKitPage() {
  const ws = await getWorkspace();
  if (!ws.project) redirect("/onboarding");
  if (ws.activeShip) redirect(`/app/ships/${ws.activeShip.id}/kit`);

  return (
    <>
      <div className="phead">
        <div>
          <h1 className="pg">Launch kit</h1>
          <div className="psub">Select a ship to see its drafts.</div>
        </div>
      </div>
      <SelectShipPrompt ships={ws.ships} mode="kit" />
    </>
  );
}
