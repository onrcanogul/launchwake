-- LLM product classification cache on Project. Lets the analysis pipeline decide
-- when short-form channels (TikTok/Reels/Shorts) belong, instead of keyword
-- heuristics alone. All additive/nullable, so existing rows are unaffected;
-- `classificationHash` (sha256 of name+description+url) gates re-classification so
-- repeat plan builds cost zero extra LLM calls.

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "classificationJson" JSONB,
ADD COLUMN     "classificationHash" TEXT,
ADD COLUMN     "classifiedAt" TIMESTAMP(3);
