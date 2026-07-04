-- CreateEnum
CREATE TYPE "WebhookSource" AS ENUM ('GITHUB', 'STRIPE');

-- CreateEnum
CREATE TYPE "WebhookDeliveryStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'FAILED');

-- CreateTable
CREATE TABLE "WebhookDelivery" (
    "id" TEXT NOT NULL,
    "source" "WebhookSource" NOT NULL,
    "projectId" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "eventType" TEXT,
    "payload" JSONB NOT NULL,
    "signature" TEXT,
    "status" "WebhookDeliveryStatus" NOT NULL DEFAULT 'RECEIVED',
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextRetryAt" TIMESTAMP(3),
    "shipId" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WebhookDelivery_source_dedupeKey_key" ON "WebhookDelivery"("source", "dedupeKey");

-- CreateIndex
CREATE INDEX "WebhookDelivery_status_nextRetryAt_idx" ON "WebhookDelivery"("status", "nextRetryAt");

-- CreateIndex
CREATE INDEX "WebhookDelivery_projectId_source_status_idx" ON "WebhookDelivery"("projectId", "source", "status");

-- CreateIndex
CREATE INDEX "WebhookDelivery_projectId_receivedAt_idx" ON "WebhookDelivery"("projectId", "receivedAt");
