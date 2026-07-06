import { redirect } from "next/navigation";
import { getWorkspace } from "@/lib/session";
import { SelectShipPrompt } from "@/components/ship/SelectShipPrompt";

export default async function BarePitchesPage({
  params,
}: {
  params: Promise<{ project: string }>;
}) {
  const { project } = await params;
  const ws = await getWorkspace(project);
  if (ws.activeShip) redirect(`/app/${project}/ships/${ws.activeShip.id}/pitches`);

  return (
    <>
      <div className="phead">
        <div>
          <h1 className="pg">Newsletter pitches</h1>
          <div className="psub">Select a ship to pitch newsletters for it.</div>
        </div>
      </div>
      <SelectShipPrompt projectId={project} ships={ws.ships} mode="pitches" />
    </>
  );
}
