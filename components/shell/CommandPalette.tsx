"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/Icon";
import {
  buildPaletteItems,
  filterPalette,
  type PaletteShip,
} from "@/lib/palette";

/**
 * The ⌘K quick jumper. Opens from the top-bar search button or the keyboard
 * shortcut; jumps to interior screens and this project's ships. Kept
 * deliberately small — a filter input over a static list, no async, no
 * portals, no fuzzy scoring.
 */
export function CommandPalette({
  projectId,
  ships,
  activeShipId,
  open,
  onOpenChange,
}: {
  projectId: string;
  ships: PaletteShip[];
  activeShipId: string | null;
  /** Controlled by the shell so the top-bar search button can open it too. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const items = useMemo(
    () => buildPaletteItems(projectId, ships, activeShipId),
    [projectId, ships, activeShipId],
  );
  const hits = useMemo(() => filterPalette(items, query), [items, query]);

  const close = useCallback(() => {
    onOpenChange(false);
    setQuery("");
    setCursor(0);
  }, [onOpenChange]);

  // Global shortcut: ⌘K (mac) / Ctrl+K.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  // Route change (a pick, back/forward…) always closes.
  useEffect(() => {
    close();
  }, [pathname, close]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Keep the highlighted row in view while arrowing through the list.
  useEffect(() => {
    listRef.current
      ?.querySelector('[aria-selected="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  const pick = (href: string) => {
    close();
    router.push(href);
  };

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, hits.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const hit = hits[cursor];
      if (hit) pick(hit.href);
    } else if (e.key === "Escape") {
      close();
    }
  };

  if (!open) return null;

  return (
    <div
      className="cmdk-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        className="cmdk"
        role="dialog"
        aria-modal="true"
        aria-label="Quick jump"
      >
        <div className="cmdk-head">
          <Icon name="search" />
          <input
            ref={inputRef}
            className="cmdk-input"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCursor(0);
            }}
            onKeyDown={onInputKey}
            placeholder="Jump to a screen or ship…"
            aria-label="Search screens and ships"
            role="combobox"
            aria-expanded
            aria-controls="cmdk-list"
            aria-activedescendant={hits[cursor] ? `cmdk-${hits[cursor].id}` : undefined}
          />
          <span className="kbd">esc</span>
        </div>
        <div className="cmdk-list" id="cmdk-list" role="listbox" ref={listRef}>
          {hits.length === 0 ? (
            <div className="cmdk-empty">No matches — try a screen name or ship title.</div>
          ) : (
            hits.map((it, i) => (
              <button
                key={it.id}
                id={`cmdk-${it.id}`}
                type="button"
                role="option"
                aria-selected={i === cursor}
                className={`cmdk-item ${i === cursor ? "on" : ""}`}
                onMouseEnter={() => setCursor(i)}
                onClick={() => pick(it.href)}
              >
                <Icon name={it.icon as IconName} />
                <span className="cmdk-label">{it.label}</span>
                <span className="cmdk-hint">{it.hint}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
