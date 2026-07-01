"use client";

import { useEffect } from "react";
import { setActiveShip } from "@/app/app/actions";

/**
 * Persists the viewed ship as the active ship (cookie) when a ship page loads —
 * so visiting a ship (via URL, feed, or switcher) makes it the remembered
 * selection for the project-wide sidebar nav. Fire-and-forget.
 */
export function SyncActiveShip({ id }: { id: string }) {
  useEffect(() => {
    void setActiveShip(id);
  }, [id]);
  return null;
}
