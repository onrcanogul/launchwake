/**
 * Lead capture for the public lead-magnet tools. A lead is an email + the
 * context that produced it, stored before the person has an account. Kept
 * deliberately thin: validation + insert. Conversion into a real User happens
 * later (matched by email at signup).
 */

import { z } from "zod";
import { db } from "./db";

export const LeadInputSchema = z.object({
  email: z.string().email().max(320),
  source: z.string().min(1).max(64),
  repo: z.string().max(200).optional(),
  projectName: z.string().max(200).optional(),
  // Snapshot of the teaser plan we showed (JSON), so we can rebuild/email it.
  context: z.unknown().optional(),
});

export type LeadInput = z.infer<typeof LeadInputSchema>;

/** Persist a captured lead. Returns the new lead id. */
export async function captureLead(input: LeadInput): Promise<{ id: string }> {
  const lead = await db.lead.create({
    data: {
      email: input.email.toLowerCase().trim(),
      source: input.source,
      repo: input.repo ?? null,
      projectName: input.projectName ?? null,
      context: (input.context ?? undefined) as never,
    },
    select: { id: true },
  });
  return lead;
}
