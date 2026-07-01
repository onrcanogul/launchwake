-- CreateEnum
CREATE TYPE "ReminderMethod" AS ENUM ('EMAIL', 'SLACK');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'CANCELED');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "slackWebhookUrl" TEXT;

-- CreateTable
CREATE TABLE "Reminder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "shipId" TEXT NOT NULL,
    "channelName" TEXT NOT NULL,
    "shipTitle" TEXT NOT NULL,
    "bestTimeLabel" TEXT,
    "ruleNote" TEXT,
    "method" "ReminderMethod" NOT NULL,
    "sendAt" TIMESTAMP(3) NOT NULL,
    "status" "ReminderStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Reminder_status_sendAt_idx" ON "Reminder"("status", "sendAt");

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
