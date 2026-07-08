import { Platform, BanRisk } from "@prisma/client";
import { z } from "zod";
// Canonical account-requirements schema lives in /lib (framework-agnostic).
// Imported via a relative path so the tsx-run seed doesn't rely on the `@/` alias.
import {
  AccountRequirementsSchema,
  type AccountRequirementsInput,
} from "../../lib/accountReadiness";
import { ChannelCostSchema, type ChannelCostInput } from "../../lib/channelCost";

/**
 * One seeded channel. The catalog is the intelligence asset — every entry is a
 * REAL community with REAL posting norms (inventing one gets users banned). New
 * channels are added by dropping typed entries into a category file under
 * `prisma/channels/` and re-seeding; the pipeline validates + dedupes on the way in.
 */
export type Seed = {
  slug: string;
  name: string;
  platform: Platform;
  url: string;
  audienceDesc: string;
  rules: string;
  defaultBanRisk: BanRisk;
  bestTime: string;
  tags: string[];
  /**
   * Optional per-channel account-readiness data (age/karma thresholds, profile
   * tips, source). Drives launch-mode "account readiness" tips + at-risk warnings.
   */
  accountRequirements?: AccountRequirementsInput;
  /**
   * Optional cost to submit/list here. Absent = free (the default for the vast
   * majority of the catalog); only paid/freemium venues carry an explicit entry.
   * Shape: lib/channelCost.ts. Surfaces a plan-card badge + a prompt cost note.
   */
  cost?: ChannelCostInput;
};

/** Boot-time validation so a malformed entry fails the seed loudly, not silently. */
export const SeedSchema = z.object({
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, "slug must be kebab-case (a-z, 0-9, -)"),
  name: z.string().min(1),
  platform: z.nativeEnum(Platform),
  url: z.string().url(),
  audienceDesc: z.string().min(1),
  rules: z.string().min(10, "rules must be a real, useful note"),
  defaultBanRisk: z.nativeEnum(BanRisk),
  bestTime: z.string().min(1),
  tags: z
    .array(z.string().regex(/^[a-z0-9+.-]+$/, "tags must be lowercase"))
    .min(1),
  accountRequirements: AccountRequirementsSchema.optional(),
  cost: ChannelCostSchema.optional(),
});
