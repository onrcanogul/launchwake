-- CreateEnum
CREATE TYPE "QueuePhase" AS ENUM ('CHANGELOG', 'DIRECTORIES', 'NEWSLETTERS', 'SUBREDDITS', 'SHOW_HN_RELAUNCH');

-- CreateEnum
CREATE TYPE "QueueTaskStatus" AS ENUM ('PENDING', 'DONE', 'SKIPPED');

-- CreateTable
CREATE TABLE "QueueTask" (
    "id" TEXT NOT NULL,
    "shipId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "phase" "QueuePhase" NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "status" "QueueTaskStatus" NOT NULL DEFAULT 'PENDING',
    "doneAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QueueTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QueueTask_status_dueAt_idx" ON "QueueTask"("status", "dueAt");

-- CreateIndex
CREATE INDEX "QueueTask_shipId_idx" ON "QueueTask"("shipId");

-- CreateIndex
CREATE UNIQUE INDEX "QueueTask_shipId_channelId_phase_key" ON "QueueTask"("shipId", "channelId", "phase");

-- AddForeignKey
ALTER TABLE "QueueTask" ADD CONSTRAINT "QueueTask_shipId_fkey" FOREIGN KEY ("shipId") REFERENCES "Ship"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueueTask" ADD CONSTRAINT "QueueTask_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
