import { buildPlan } from "./analysis";

/**
 * Background-job seam. For the MVP these run inline; the boundary is here so they
 * can be moved behind Inngest (async analysis + stat rollups) without touching
 * callers. Keep job functions idempotent.
 */
export async function runAnalysisJob(shipId: string): Promise<void> {
  await buildPlan(shipId);
}
