"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/ui/toast";
import { AUDIENCE_LANGUAGES, resolveAudience } from "@/lib/audience";
import { setShipAudience } from "@/app/app/ships/actions";

/**
 * In-header override for the plan's audience language. Picking a language sets
 * the ship's override and rebuilds the plan in that language — the same delete-
 * recreate a Re-run does, so the whole plan comes back localized. Mirrors the
 * ShipSwitcher dropdown so the header reads as one control group.
 */
export function AudiencePicker({
  shipId,
  current,
}: {
  shipId: string;
  /** The ship's effective audience code (ship override ?? project default). */
  current: string;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  // Optimistic selection so the button label flips before the rebuild returns.
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const activeCode = pendingCode ?? current;
  const active = resolveAudience(activeCode);

  useEffect(() => {
    setPendingCode(null);
  }, [current]);

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

  const pick = (code: string) => {
    setOpen(false);
    if (code === activeCode) return;
    setPendingCode(code);
    start(async () => {
      try {
        await setShipAudience(shipId, code);
        toast(`Plan rewritten in ${resolveAudience(code).label}`);
      } catch {
        setPendingCode(null);
        toast("Could not switch audience", "error");
      }
    });
  };

  return (
    <div className="shipsw" ref={ref}>
      <button
        className="btn btn-s"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Audience language"
        disabled={pending}
        title="Audience language for this plan"
      >
        <Icon name="channels" />
        <span>{active.label}</span>
        {pending ? (
          <span className="lw-spin" aria-label="Rebuilding" />
        ) : (
          <Icon name="chevronDown" />
        )}
      </button>

      {open && (
        <div className="shipsw-menu" role="listbox">
          {AUDIENCE_LANGUAGES.map((l) => (
            <button
              key={l.code}
              className={["shipsw-item", l.code === activeCode ? "on" : ""].join(" ")}
              onClick={() => pick(l.code)}
              role="option"
              aria-selected={l.code === activeCode}
            >
              <span className="t">{l.label}</span>
              {l.code === activeCode && (
                <Icon name="check" style={{ width: 13, height: 13, stroke: "var(--ac)" }} />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
