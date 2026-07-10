import { db } from "./db";
import { captureError } from "./observability";
import {
  classifyProduct,
  classificationToTags,
  classificationInputHash,
  ProductClassificationSchema,
  type ProductClassification,
} from "./classify";
import type { MatchContext } from "./channels";
import type { Project, Ship } from "@prisma/client";

/**
 * Project channel-fit context — the ONE place channel-fit signals are assembled.
 *
 * Every authenticated surface that ranks the catalog (the distribution plan, the
 * Channels directory, the sequenced queue, newsletter picks, subreddit radar)
 * routes through `getProjectTagContext` so they gate short-form channels
 * IDENTICALLY: raw-text heuristics MERGED with the LLM product classification.
 * Before this, only `buildPlan` merged the classification, so TikTok/Reels/Shorts
 * showed up in a plan but never in the Channels directory for the same product.
 *
 * Golden rule intact: the classification only ever produces catalog fit-TAGS; it
 * never names or invents a channel. The anonymous public Launch Checker has no
 * Project row and stays heuristic by design — it does NOT use this helper.
 */

/** Project fields needed to resolve + cache a classification. */
export type ClassifiableProject = Pick<
  Project,
  | "id"
  | "userId"
  | "name"
  | "description"
  | "url"
  | "classificationJson"
  | "classificationHash"
>;

export type TagContextOptions = {
  /** Ship whose title/summary enrich a fresh classify + become `shipText`. */
  ship?: Pick<Ship, "title" | "summary" | "type"> | null;
  /** Override the derived ship type (defaults to `ship?.type` ?? "OTHER"). */
  shipType?: string;
  /** Extra text folded into `projectText` (e.g. GitHub topics). */
  extraProjectText?: string;
  /** First-launch bias — favors launch venues. */
  launchContext?: boolean;
  /**
   * When true (the default), a cache MISS triggers ONE budget-guarded classify
   * call and persists the result. When false, only an already-cached
   * classification is used and the LLM is never called — for secondary paths
   * (queue/radar/newsletters) that must not add an LLM round-trip. Either way the
   * page never blocks on the LLM: an unconfigured/failed call falls back to the
   * pure heuristic.
   */
  classifyOnMiss?: boolean;
};

/**
 * Resolve the product classification for a project — the cached value when the
 * product inputs (name/description/url) are unchanged, else (when
 * `classifyOnMiss`) one budget-guarded classify call, persisted so repeat reads
 * cost nothing. Never throws; returns null when the product can't be classified
 * (LLM unconfigured or the call failed) so callers fall back to the heuristic.
 */
export async function resolveProjectClassification(
  project: ClassifiableProject,
  opts?: { ship?: Pick<Ship, "title" | "summary"> | null; classifyOnMiss?: boolean },
): Promise<ProductClassification | null> {
  const hash = classificationInputHash(project);

  // Cache hit: product inputs unchanged since the last classification.
  if (project.classificationHash === hash && project.classificationJson != null) {
    const parsed = ProductClassificationSchema.safeParse(project.classificationJson);
    if (parsed.success) return parsed.data;
    // A drifted/invalid cached shape falls through to re-classify.
  }

  // Cache-only callers stop here — no LLM latency, just the heuristic downstream.
  if (opts?.classifyOnMiss === false) return null;

  const classification = await classifyProduct(
    {
      name: project.name,
      description: project.description,
      url: project.url,
      shipTitle: opts?.ship?.title,
      shipSummary: opts?.ship?.summary,
    },
    project.userId,
  );
  if (!classification) return null;

  // Persist so the next read for an unchanged product is free. Best-effort: a
  // write hiccup must not fail the caller — we already hold the classification.
  await db.project
    .update({
      where: { id: project.id },
      data: {
        classificationJson: classification,
        classificationHash: hash,
        classifiedAt: new Date(),
      },
    })
    .catch((err) => {
      captureError(err, {
        at: "projectTags.resolveProjectClassification",
        reason: "cache_write_failed",
      });
    });

  return classification;
}

/**
 * Build the `matchChannels` context for a project, MERGING the LLM classification
 * tags into the raw-text heuristic signal set. Returns the resolved classification
 * too, for callers that render its `reason` (the ranking prompt). A low-confidence
 * or unavailable classification contributes no consumer/visual tags (see
 * `classificationToTags`), so the fail-closed short-form gate is preserved
 * everywhere — a devtool never gets short-form, in a plan OR in the directory.
 */
export async function getProjectTagContext(
  project: ClassifiableProject,
  opts?: TagContextOptions,
): Promise<{ ctx: MatchContext; classification: ProductClassification | null }> {
  const classification = await resolveProjectClassification(project, {
    ship: opts?.ship ?? null,
    classifyOnMiss: opts?.classifyOnMiss,
  });
  const classificationTags = classification
    ? classificationToTags(classification)
    : [];

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
    classificationTags,
  };

  return { ctx, classification };
}
