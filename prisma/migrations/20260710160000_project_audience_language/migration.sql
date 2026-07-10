-- Target-audience language for GENERATED content (platform drafts + analysis
-- "why"/rules) and channel-ranking bias. This localizes OUTPUT only — the app UI
-- stays English. Project holds the default; Ship holds an optional per-plan
-- override (null = inherit the project default). Both additive: the Project
-- column defaults to 'en' so existing projects keep English output, and the Ship
-- column is nullable so existing ships inherit their project's default.

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "audienceLanguage" TEXT NOT NULL DEFAULT 'en';

-- AlterTable
ALTER TABLE "Ship" ADD COLUMN     "audienceLanguage" TEXT;
