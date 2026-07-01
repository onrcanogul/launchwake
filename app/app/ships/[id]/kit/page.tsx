import { notFound, redirect } from "next/navigation";
import { getWorkspace } from "@/lib/session";
import { getShipKit } from "@/lib/plans";
import { listProjectShips } from "@/lib/ships";
import { LaunchKit } from "@/components/ship/LaunchKit";
import { ShipSwitcher } from "@/components/ship/ShipSwitcher";
import { SyncActiveShip } from "@/components/ship/SyncActiveShip";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";

export default async function KitPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ rec?: string }>;
}) {
  const { id } = await params;
  const { rec } = await searchParams;
  const ws = await getWorkspace();
  if (!ws.project) redirect("/onboarding");

  const kit = await getShipKit(id, ws.user.id);
  if (!kit) notFound();

  const ships = await listProjectShips(ws.project.id);

  return (
    <>
      <SyncActiveShip id={kit.ship.id} />
      <div className="phead">
        <div>
          <h1 className="pg">Launch kit</h1>
          <div className="psub">
            Drafts for &ldquo;{kit.ship.title}&rdquo;. Copy, tweak, and post from
            your own account — LaunchWake never posts for you.
          </div>
        </div>
        {ships.length > 1 && (
          <ShipSwitcher ships={ships} currentId={kit.ship.id} mode="kit" />
        )}
      </div>

      {kit.recs.length === 0 ? (
        <EmptyState
          icon="kit"
          title="No channels to draft for"
          message="Build a distribution plan first — the launch kit generates a draft per recommended channel."
          actions={
            <Button variant="primary" icon="where" href={`/app/ships/${id}/plan`}>
              Go to plan
            </Button>
          }
        />
      ) : (
        <LaunchKit recs={kit.recs} initialRecId={rec} />
      )}
    </>
  );
}
