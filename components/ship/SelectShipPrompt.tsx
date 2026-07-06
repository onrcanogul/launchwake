import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { ShipTypeTag, type ShipTypeValue } from "@/components/ui/ShipTypeTag";

type Ship = { id: string; title: string; type: ShipTypeValue };

/**
 * Shown on ship-scoped screens (Where to post / Launch kit) when no ship is
 * selected. Lets the user pick one, or create their first.
 */
export function SelectShipPrompt({
  projectId,
  ships,
  mode,
}: {
  projectId: string;
  ships: Ship[];
  mode: "plan" | "kit" | "launch" | "queue" | "pitches";
}) {
  if (ships.length === 0) {
    return (
      <EmptyState
        icon="grid"
        title="No ships yet"
        message="Create your first ship — a release, feature or post worth talking about — and we'll build its distribution plan."
        actions={
          <Button variant="primary" icon="plus" href={`/app/${projectId}/ships/new`}>
            New ship
          </Button>
        }
      />
    );
  }

  return (
    <>
      <EmptyState
        icon={mode === "plan" ? "where" : mode === "launch" ? "rocket" : mode === "queue" ? "calendar" : mode === "pitches" ? "mail" : "kit"}
        title="Select a ship first"
        message="Pick a ship to see its distribution plan and drafts. Your choice is remembered and drives the ship menu."
      />
      <div className="panel" style={{ marginTop: 16, maxWidth: 600 }}>
        <div className="ph">
          <h2>Your ships</h2>
          <span className="r">pick one</span>
        </div>
        {ships.map((s) => (
          <Link
            key={s.id}
            href={`/app/${projectId}/ships/${s.id}/${mode}`}
            className="li"
            style={{ color: "inherit" }}
          >
            <div className="lft">
              <ShipTypeTag type={s.type} />
              <div className="tt">{s.title}</div>
            </div>
            <span className="badge ac">Open →</span>
          </Link>
        ))}
      </div>
    </>
  );
}
