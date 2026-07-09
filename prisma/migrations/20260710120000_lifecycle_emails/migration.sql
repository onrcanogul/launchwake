-- Lifecycle emails (milestones, activation drip, monthly report). A per-user
-- ledger of one-shot sends so nothing repeats, plus a milestone-throttle stamp on
-- User. All additive/nullable/defaulted, so existing rows are unaffected.

-- CreateEnum
CREATE TYPE "LifecycleEmailKind" AS ENUM ('FIRST_CLICK', 'FIRST_SIGNUP', 'SIGNUP_COUNT', 'DRIP_WELCOME', 'DRIP_PIXEL', 'DRIP_LAUNCH', 'MONTHLY_REPORT');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "lastMilestoneAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "LifecycleEmail" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "LifecycleEmailKind" NOT NULL,
    "key" TEXT NOT NULL DEFAULT '',
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LifecycleEmail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LifecycleEmail_userId_kind_idx" ON "LifecycleEmail"("userId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "LifecycleEmail_userId_kind_key_key" ON "LifecycleEmail"("userId", "kind", "key");

-- AddForeignKey
ALTER TABLE "LifecycleEmail" ADD CONSTRAINT "LifecycleEmail_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
