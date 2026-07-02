"use client";

import { Icon } from "@/components/Icon";

/** Print / Save as PDF — the report page is print-optimized. */
export function PrintButton() {
  return (
    <button className="btn btn-s wl-print" onClick={() => window.print()}>
      <Icon name="rss" /> Save as PDF
    </button>
  );
}
