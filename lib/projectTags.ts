import type { MatchContext } from "./channels";
import type { Project, Ship } from "@prisma/client";

/**
 * Project channel-fit context — the ONE place channel-fit signals are assembled.
 *
 * Every authenticated surface that ranks the catalog (the distribution plan, the
 * Channels directory, the sequenced queue, newsletter picks, subreddit radar)
 * routes through `getProjectTagContext`, so they all derive fit signals the same
 * way: keyword heuristics over the product + ship text.
 *
 * Fit is decided by SCORE, not by a hard product-type gate. There are no b2c/b2b
 * classification concepts here: short-form video channels compete on tag overlap
 * like everything else (see `matchChannels`), and the distribution plan hands them
 * to the LLM, which makes the final per-ship fit call (see `lib/analysis.ts`).
 */

/** Project fields needed to build a match context. */
export type ClassifiableProject = Pick<
  Project,
  "id" | "name" | "description" | "url"
>;

export type TagContextOptions = {
  /** Ship whose title/summary become `shipText` and derive the ship type. */
  ship?: Pick<Ship, "title" | "summary" | "type"> | null;
  /** Override the derived ship type (defaults to `ship?.type` ?? "OTHER"). */
  shipType?: string;
  /** Extra text folded into `projectText` (e.g. GitHub topics). */
  extraProjectText?: string;
  /** First-launch bias — favors launch venues. */
  launchContext?: boolean;
};

/**
 * Build the `matchChannels` context for a project from its (and the ship's) text.
 * Pure and cheap — no LLM call, no DB write — so every surface can call it freely.
 */
export async function getProjectTagContext(
  project: ClassifiableProject,
  opts?: TagContextOptions,
): Promise<{ ctx: MatchContext }> {
  const projectText = [
    project.name,
    project.description ?? "",
    project.url ?? "",
    opts?.extraProjectText ?? "",
  ]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  const shipText = opts?.ship
    ? `${opts.ship.title} ${opts.ship.summary ?? ""}`.replace(/\s+/g, " ").trim()
    : "";

  const ctx: MatchContext = {
    projectText,
    shipText,
    shipType: opts?.shipType ?? opts?.ship?.type ?? "OTHER",
    launchContext: opts?.launchContext,
  };

  return { ctx };
}
