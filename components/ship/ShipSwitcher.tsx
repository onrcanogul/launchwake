"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { ShipTypeTag, type ShipTypeValue } from "@/components/ui/ShipTypeTag";

export type SwitcherShip = {
  id: string;
  title: string;
  type: ShipTypeValue;
};

/** In-header dropdown to switch which ship the plan/kit screen is scoped to. */
export function ShipSwitcher({
  projectId,
  ships,
  currentId,
  mode,
}: {
  projectId: string;
  ships: SwitcherShip[];
  currentId: string;
  mode: "plan" | "kit" | "launch" | "queue" | "pitches";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  // Optimistic selection: reflect the picked ship instantly, before the server
  // component for the new ship finishes loading.
  const [pendingId, setPendingId] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const activeId = pendingId ?? currentId;
  const active = ships.find((s) => s.id === activeId);

  // Clear the optimistic id once the real route (currentId prop) catches up.
  useEffect(() => {
    setPendingId(null);
  }, [currentId]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = (id: string) => {
    setOpen(false);
    if (id === currentId) return;
    setPendingId(id); // instant dropdown feedback
    startTransition(() => router.push(`/app/${projectId}/ships/${id}/${mode}`));
  };

  return (
    <div className="shipsw" ref={ref}>
      <button
        className="btn btn-s"
        style={{ maxWidth: 260 }}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {active?.title ?? "Select ship"}
        </span>
        {pending ? (
          <span className="lw-spin" aria-label="Switching" />
        ) : (
          <Icon name="chevronDown" />
        )}
      </button>

      {open && (
        <div className="shipsw-menu" role="listbox">
          {ships.map((s) => (
            <button
              key={s.id}
              className={["shipsw-item", s.id === activeId ? "on" : ""].join(" ")}
              onClick={() => pick(s.id)}
              role="option"
              aria-selected={s.id === activeId}
            >
              <ShipTypeTag type={s.type} />
              <span className="t">{s.title}</span>
              {s.id === activeId && (
                <Icon name="check" style={{ width: 13, height: 13, stroke: "var(--ac)" }} />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
