-- CreateEnum
CREATE TYPE "PitchStatus" AS ENUM ('DRAFT', 'SENT', 'REPLIED', 'DECLINED');

-- CreateTable
CREATE TABLE "NewsletterPitch" (
    "id" TEXT NOT NULL,
    "shipId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "PitchStatus" NOT NULL DEFAULT 'DRAFT',
    "sentAt" TIMESTAMP(3),
    "followUpAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NewsletterPitch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NewsletterPitch_status_followUpAt_idx" ON "NewsletterPitch"("status", "followUpAt");

-- CreateIndex
CREATE UNIQUE INDEX "NewsletterPitch_shipId_channelId_key" ON "NewsletterPitch"("shipId", "channelId");

-- AddForeignKey
ALTER TABLE "NewsletterPitch" ADD CONSTRAINT "NewsletterPitch_shipId_fkey" FOREIGN KEY ("shipId") REFERENCES "Ship"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsletterPitch" ADD CONSTRAINT "NewsletterPitch_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
