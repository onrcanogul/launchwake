-- Attribution data-integrity hardening.
--
-- 1) `dedupeKey`: idempotency key for CLICK/SIGNUP events. Nullable, so every
--    existing row keeps NULL and no historical data is touched.
-- 2) `verified`: trust flag for REVENUE amounts. Defaults TRUE so existing rows
--    (and all signature-verified server paths) stay counted; only new unsigned
--    public /api/track/revenue calls are written FALSE.
ALTER TABLE "Event" ADD COLUMN "dedupeKey" TEXT;
ALTER TABLE "Event" ADD COLUMN "verified" BOOLEAN NOT NULL DEFAULT true;

-- Idempotency: enforce "at most one CLICK/SIGNUP per (link, type, dedupeKey)".
-- PARTIAL so the constraint only covers rows carrying a key — the millions of
-- legacy rows (dedupeKey IS NULL) are excluded and never collide, so this is
-- safe to apply to a populated table. Inserts use ON CONFLICT DO NOTHING, which
-- (with no conflict target) honors this partial index too.
CREATE UNIQUE INDEX "Event_trackedLinkId_type_dedupeKey_key"
  ON "Event" ("trackedLinkId", "type", "dedupeKey")
  WHERE "dedupeKey" IS NOT NULL;
