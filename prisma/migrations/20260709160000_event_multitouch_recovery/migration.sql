-- Attribution capture: multi-touch, cross-device recovery, and unattributed signups.
--
-- 1) `trackedLinkId` becomes nullable — an unattributed SIGNUP (no lw_ref, no email
--    match) has no channel/link. Existing rows all have it set, so this is safe.
-- 2) `projectId` links those link-less events straight to a project so totals still
--    reconcile (the dark-social share). Null for link-attributed events.
-- 3) `emailHash` stores sha256(lowercased email) — never the raw email — on a CLICK
--    (cross-device recovery) or SIGNUP (which identity converted).
ALTER TABLE "Event" ALTER COLUMN "trackedLinkId" DROP NOT NULL;
ALTER TABLE "Event" ADD COLUMN "projectId" TEXT;
ALTER TABLE "Event" ADD COLUMN "emailHash" TEXT;

ALTER TABLE "Event" ADD CONSTRAINT "Event_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Event_emailHash_idx" ON "Event" ("emailHash");
CREATE INDEX "Event_projectId_type_idx" ON "Event" ("projectId", "type");

-- Idempotency for link-less (unattributed) signups. The existing
-- (trackedLinkId, type, dedupeKey) partial unique index can't cover them because
-- NULL trackedLinkIds are all distinct in a unique index, so add a project-scoped
-- partial unique index for the link-less rows. ON CONFLICT DO NOTHING honors it.
CREATE UNIQUE INDEX "Event_projectId_type_dedupeKey_key"
  ON "Event" ("projectId", "type", "dedupeKey")
  WHERE "trackedLinkId" IS NULL AND "dedupeKey" IS NOT NULL;
