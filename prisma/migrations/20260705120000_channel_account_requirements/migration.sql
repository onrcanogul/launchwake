-- Add optional per-channel account-readiness data (age/karma thresholds, profile
-- tips, source). Shape validated in application code by
-- lib/accountReadiness.ts (AccountRequirementsSchema).
ALTER TABLE "Channel" ADD COLUMN "accountRequirements" JSONB;
