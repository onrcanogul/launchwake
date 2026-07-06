import { redirect } from "next/navigation";
import { getWorkspace } from "@/lib/session";
import { SelectShipPrompt } from "@/components/ship/SelectShipPrompt";

export default async function BareLaunchPage({
  params,
}: {
  params: Promise<{ project: string }>;
}) {
  const { project } = await params;
  const ws = await getWorkspace(project);
  if (ws.activeShip) redirect(`/app/${project}/ships/${ws.activeShip.id}/launch`);

  return (
    <>
      <div className="phead">
        <div>
          <h1 className="pg">Launch day</h1>
          <div className="psub">Select a ship to see its launch run sheet.</div>
        </div>
      </div>
      <SelectShipPrompt projectId={project} ships={ws.ships} mode="launch" />
    </>
  );
}
