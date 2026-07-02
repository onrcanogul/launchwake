import { redirect } from "next/navigation";
import { getWorkspace } from "@/lib/session";
import { SelectShipPrompt } from "@/components/ship/SelectShipPrompt";

export default async function BareQueuePage() {
  const ws = await getWorkspace();
  if (!ws.project) redirect("/onboarding");
  if (ws.activeShip) redirect(`/app/ships/${ws.activeShip.id}/queue`);

  return (
    <>
      <div className="phead">
        <div>
          <h1 className="pg">Distribution queue</h1>
          <div className="psub">Select a ship to see its distribution cadence.</div>
        </div>
      </div>
      <SelectShipPrompt ships={ws.ships} mode="queue" />
    </>
  );
}
