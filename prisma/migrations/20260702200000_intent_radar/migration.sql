-- CreateEnum
CREATE TYPE "IntentSource" AS ENUM ('HN', 'REDDIT');

-- CreateEnum
CREATE TYPE "IntentMatchStatus" AS ENUM ('NEW', 'NOTIFIED', 'SAVED', 'DISMISSED');

-- CreateTable
CREATE TABLE "IntentQuery" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "phrases" TEXT[],
    "keywords" TEXT[],
    "subreddits" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntentQuery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntentMatch" (
    "id" TEXT NOT NULL,
    "queryId" TEXT NOT NULL,
    "source" "IntentSource" NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "author" TEXT,
    "excerpt" TEXT,
    "score" INTEGER NOT NULL,
    "matchReason" TEXT,
    "postedAt" TIMESTAMP(3) NOT NULL,
    "status" "IntentMatchStatus" NOT NULL DEFAULT 'NEW',
    "draftBody" TEXT,
    "safetyNote" TEXT,
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntentMatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IntentQuery_projectId_idx" ON "IntentQuery"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "IntentMatch_queryId_externalId_key" ON "IntentMatch"("queryId", "externalId");

-- CreateIndex
CREATE INDEX "IntentMatch_status_postedAt_idx" ON "IntentMatch"("status", "postedAt");

-- CreateIndex
CREATE INDEX "IntentMatch_queryId_status_idx" ON "IntentMatch"("queryId", "status");

-- AddForeignKey
ALTER TABLE "IntentQuery" ADD CONSTRAINT "IntentQuery_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntentMatch" ADD CONSTRAINT "IntentMatch_queryId_fkey" FOREIGN KEY ("queryId") REFERENCES "IntentQuery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
