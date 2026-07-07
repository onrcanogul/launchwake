import { describe, expect, it } from "vitest";
import { buildPaletteItems, filterPalette } from "./palette";

const ships = [
  { id: "s1", title: "v2.0 — Realtime sync" },
  { id: "s2", title: "Blog: how we ship" },
];

describe("buildPaletteItems", () => {
  it("always includes workspace nav", () => {
    const items = buildPaletteItems("proj", [], null);
    const labels = items.map((i) => i.label);
    expect(labels).toContain("Ship feed");
    expect(labels).toContain("Settings");
  });

  it("hides ship-scoped nav when there are no ships (progressive disclosure)", () => {
    const items = buildPaletteItems("proj", [], null);
    expect(items.find((i) => i.id === "nav-plan")).toBeUndefined();
    expect(items.find((i) => i.hint === "Ship")).toBeUndefined();
  });

  it("scopes ship nav to the active ship when one is set", () => {
    const items = buildPaletteItems("proj", ships, "s2");
    const plan = items.find((i) => i.id === "nav-plan");
    expect(plan?.href).toBe("/app/proj/ships/s2/plan");
  });

  it("lists every ship, linking to its plan", () => {
    const items = buildPaletteItems("proj", ships, "s1");
    const shipItems = items.filter((i) => i.hint === "Ship");
    expect(shipItems).toHaveLength(2);
    expect(shipItems[1].href).toBe("/app/proj/ships/s2/plan");
  });
});

describe("filterPalette", () => {
  const items = buildPaletteItems("proj", ships, "s1");

  it("returns everything for an empty query", () => {
    expect(filterPalette(items, "  ")).toHaveLength(items.length);
  });

  it("matches labels case-insensitively", () => {
    const hits = filterPalette(items, "REALTIME");
    expect(hits).toHaveLength(1);
    expect(hits[0].label).toContain("Realtime");
  });

  it("matches hidden keywords (e.g. 'billing' → Settings)", () => {
    const hits = filterPalette(items, "billing");
    expect(hits.map((i) => i.label)).toContain("Settings");
  });

  it("returns empty for a miss", () => {
    expect(filterPalette(items, "zzz-no-match")).toHaveLength(0);
  });
});
