/**
 * Command-palette (⌘K) logic — framework-agnostic and unit-testable.
 *
 * The palette is a quick jumper over the two things a user reaches for
 * constantly: interior screens (nav) and this project's ships. Items are
 * built once per render from data the shell already has; filtering is a
 * simple case-insensitive substring match over label + keywords (no fuzzy
 * scoring — predictable beats clever at this list size).
 */

export type PaletteItem = {
  /** Stable key for React lists and selection state. */
  id: string;
  /** What the row shows. */
  label: string;
  /** Small right-aligned hint ("Ship", "Go to", …). */
  hint: string;
  /** Destination for router.push. */
  href: string;
  /** Icon name from components/Icon (kept as string to stay UI-agnostic). */
  icon: string;
  /** Extra match terms not shown in the row. */
  keywords?: string;
};

export type PaletteShip = { id: string; title: string };

/** Build the full (unfiltered) item list for a project. */
export function buildPaletteItems(
  projectId: string,
  ships: PaletteShip[],
  activeShipId: string | null,
): PaletteItem[] {
  const base = `/app/${projectId}`;
  const shipBase = activeShipId ? `${base}/ships/${activeShipId}` : base;

  const nav: PaletteItem[] = [
    { id: "nav-feed", label: "Ship feed", hint: "Go to", href: base, icon: "grid", keywords: "dashboard home ships" },
    { id: "nav-new", label: "New ship", hint: "Go to", href: `${base}/ships/new`, icon: "plus", keywords: "create add analyze release" },
    { id: "nav-channels", label: "Channels", hint: "Go to", href: `${base}/channels`, icon: "channels", keywords: "catalog communities library" },
    { id: "nav-radar", label: "Intent Radar", hint: "Go to", href: `${base}/radar`, icon: "target", keywords: "questions reddit mentions" },
    { id: "nav-results", label: "Results", hint: "Go to", href: `${base}/results`, icon: "results", keywords: "attribution clicks signups conversion" },
    { id: "nav-settings", label: "Settings", hint: "Go to", href: `${base}/settings`, icon: "settings", keywords: "billing plan tracking pixel github team" },
  ];

  // Ship-scoped screens only make sense once a ship exists (progressive
  // disclosure — same rule as the sidebar).
  const shipScoped: PaletteItem[] =
    ships.length > 0
      ? [
          { id: "nav-plan", label: "Where to post", hint: "Go to", href: `${shipBase}/plan`, icon: "where", keywords: "plan distribution channels fit" },
          { id: "nav-kit", label: "Launch kit", hint: "Go to", href: `${shipBase}/kit`, icon: "kit", keywords: "drafts copy posts" },
          { id: "nav-queue", label: "Queue", hint: "Go to", href: `${shipBase}/queue`, icon: "calendar", keywords: "schedule reminders posted" },
          { id: "nav-pitches", label: "Newsletters", hint: "Go to", href: `${shipBase}/pitches`, icon: "mail", keywords: "pitch email press" },
          { id: "nav-launch", label: "Launch day", hint: "Go to", href: `${shipBase}/launch`, icon: "rocket", keywords: "cockpit live" },
        ]
      : [];

  const shipItems: PaletteItem[] = ships.map((s) => ({
    id: `ship-${s.id}`,
    label: s.title,
    hint: "Ship",
    href: `/app/${projectId}/ships/${s.id}/plan`,
    icon: "rocket",
    keywords: "ship open plan",
  }));

  return [...nav, ...shipScoped, ...shipItems];
}

/** Case-insensitive substring filter over label + keywords. */
export function filterPalette(
  items: PaletteItem[],
  query: string,
): PaletteItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter(
    (it) =>
      it.label.toLowerCase().includes(q) ||
      (it.keywords ?? "").toLowerCase().includes(q),
  );
}
