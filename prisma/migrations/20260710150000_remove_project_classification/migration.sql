-- Remove the cached LLM product classification from Project. Short-form channel
-- fit is no longer gated by a b2c/b2b classification: short-form channels enter
-- every distribution plan and the LLM decides fit per-ship (see lib/analysis.ts).
-- Dropping these columns discards only a derived cache, so no product data is lost.

-- AlterTable
ALTER TABLE "Project" DROP COLUMN "classificationJson",
DROP COLUMN "classificationHash",
DROP COLUMN "classifiedAt";
