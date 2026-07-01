"use client";

import { useEffect, useRef, useState } from "react";
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
  ships,
  currentId,
  mode,
}: {
  ships: SwitcherShip[];
  currentId: string;
  mode: "plan" | "kit";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = ships.find((s) => s.id === currentId);

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
    if (id !== currentId) router.push(`/app/ships/${id}/${mode}`);
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
          {current?.title ?? "Select ship"}
        </span>
        <Icon name="chevronDown" />
      </button>

      {open && (
        <div className="shipsw-menu" role="listbox">
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
