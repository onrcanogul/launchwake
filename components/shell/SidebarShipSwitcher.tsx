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

/**
 * The global ship selector, living in the sidebar's "Ship ·" group header.
 * Picking a ship navigates to its plan (which persists it as the active ship
 * cookie), so the ship-scoped nav follows it from anywhere.
 */
export function SidebarShipSwitcher({
  ships,
  activeId,
}: {
  ships: SwitcherShip[];
  activeId: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const currentId = pendingId ?? activeId;
  const active = ships.find((s) => s.id === currentId);

  useEffect(() => {
    setPendingId(null);
  }, [activeId]);

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
    setPendingId(id);
    startTransition(() => router.push(`/app/ships/${id}/plan`));
  };

  return (
    <div className="shipsw shipgrp" ref={ref}>
      <button
        className="shipgrp-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={active?.title}
      >
        <span className="lbl">
          Ship · <b>{active ? active.title : "Select a ship"}</b>
        </span>
        {pending ? (
          <span className="lw-spin" aria-label="Switching" />
        ) : (
          <Icon name="chevronUpDown" />
        )}
      </button>

      {open && (
        <div
          className="shipsw-menu"
          role="listbox"
          style={{ left: 8, right: 8, minWidth: 0 }}
        >
          {ships.map((s) => (
            <button
              key={s.id}
              className={["shipsw-item", s.id === currentId ? "on" : ""].join(" ")}
              onClick={() => pick(s.id)}
              role="option"
              aria-selected={s.id === currentId}
            >
              <ShipTypeTag type={s.type} />
              <span className="t">{s.title}</span>
              {s.id === currentId && (
                <Icon name="check" style={{ width: 13, height: 13, stroke: "var(--ac)" }} />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
