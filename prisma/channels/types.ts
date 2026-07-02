import { Platform, BanRisk } from "@prisma/client";
import { z } from "zod";

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
});
