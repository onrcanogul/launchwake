"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Icon } from "@/components/Icon";
import { sectionRest, switchTarget } from "@/lib/appRoutes";

export type ProjectOption = {
  id: string;
  name: string;
  subtitle: string | null;
};

/**
 * Sidebar workspace header — a keyboard-accessible dropdown. The header markup
 * is unchanged (avatar + name + chevron); clicking it opens a menu listing the
 * account's projects (switching preserves the current section) plus a
 * "New project" action. Shown even with a single project so there's always an
 * entry point to add another (the chevron already implied it was clickable).
 */
export function ProjectSwitcher({
  projects,
  currentId,
  current,
}: {
  projects: ProjectOption[];
  currentId: string;
  current: { name: string; subtitle?: string | null };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPendingId(null);
  }, [pathname]);

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

  const inner = (
    <>
      <div className="sq">{current.name.charAt(0).toUpperCase()}</div>
      <div className="nm">
        <b>{current.name}</b>
        {current.subtitle && <span>{current.subtitle}</span>}
      </div>
      <Icon name="chevronUpDown" size={13} style={{ stroke: "var(--tx3)" }} />
    </>
  );

  const pick = (id: string) => {
    setOpen(false);
    if (id === currentId) return;
    setPendingId(id);
    startTransition(() => router.push(switchTarget(id, sectionRest(pathname))));
  };

  return (
    <div className="pswitch" ref={ref}>
      <button
        type="button"
        className="ws ws-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Switch project"
      >
        {inner}
      </button>

      {open && (
        <div
          className="shipsw-menu pswitch-menu"
          role="listbox"
          style={{ left: 8, right: 8, minWidth: 0 }}
        >
          {projects.map((p) => {
            const on = p.id === (pendingId ?? currentId);
            return (
              <button
                key={p.id}
                type="button"
                className={["shipsw-item", on ? "on" : ""].join(" ")}
                onClick={() => pick(p.id)}
                role="option"
                aria-selected={on}
              >
                <span className="sq sq-sm">{p.name.charAt(0).toUpperCase()}</span>
                <span className="t">{p.name}</span>
                {on &&
                  (pending && p.id === pendingId ? (
                    <span className="lw-spin" aria-label="Switching" />
                  ) : (
                    <Icon
                      name="check"
                      style={{ width: 13, height: 13, stroke: "var(--ac)" }}
                    />
                  ))}
              </button>
            );
          })}
          <div className="pswitch-sep" />
          <Link
            href="/onboarding"
            className="shipsw-item pswitch-new"
            role="option"
            onClick={() => setOpen(false)}
          >
            <Icon name="plus" />
            <span className="t">New project</span>
          </Link>
        </div>
      )}
    </div>
  );
}
