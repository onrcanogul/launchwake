import { SeedSchema, type Seed } from "./types";
import { core } from "./core";
import { subreddits } from "./subreddits";
import { newsletters } from "./newsletters";
import { directories } from "./directories";
import { communities } from "./communities";
import { social } from "./social";
import { shortform } from "./shortform";

/**
 * The seed pipeline: category files → one validated, de-duplicated catalog.
 *
 * Adding channels = drop typed entries into the relevant category file (or add a
 * new file and register it here). `assembleCatalog()` validates every entry
 * against the zod schema and fails loudly on a bad row or a duplicate slug, so a
 * malformed contribution never reaches the database.
 */

export const CATEGORIES: Record<string, Seed[]> = {
  core,
  subreddits,
  newsletters,
  directories,
  communities,
  social,
  shortform,
};

export type CatalogIssue = { kind: "invalid" | "duplicate"; slug: string; detail: string };

export type AssembledCatalog = {
  channels: Seed[];
  issues: CatalogIssue[];
  byCategory: Record<string, number>;
};

/** Validate + dedupe every category into a single catalog. Pure → unit-testable. */
export function assembleCatalog(
  categories: Record<string, Seed[]> = CATEGORIES,
): AssembledCatalog {
  const channels: Seed[] = [];
  const issues: CatalogIssue[] = [];
  const byCategory: Record<string, number> = {};
  const seen = new Set<string>();

  for (const [category, entries] of Object.entries(categories)) {
    byCategory[category] = entries.length;
    for (const entry of entries) {
      const parsed = SeedSchema.safeParse(entry);
      if (!parsed.success) {
        issues.push({
          kind: "invalid",
          slug: entry.slug ?? "(no slug)",
          detail: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
        });
        continue;
      }
      if (seen.has(parsed.data.slug)) {
        issues.push({ kind: "duplicate", slug: parsed.data.slug, detail: `also in another category` });
        continue;
      }
      seen.add(parsed.data.slug);
      channels.push(parsed.data);
    }
  }

  return { channels, issues, byCategory };
}

/** The validated catalog, or throw if any entry is malformed/duplicated. */
export function channelCatalog(): Seed[] {
  const { channels, issues } = assembleCatalog();
  if (issues.length > 0) {
    const lines = issues.map((i) => `  • [${i.kind}] ${i.slug}: ${i.detail}`).join("\n");
    throw new Error(`Channel catalog has ${issues.length} issue(s):\n${lines}`);
  }
  return channels;
}
