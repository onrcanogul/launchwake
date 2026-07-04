-- CreateEnum
CREATE TYPE "WebhookSource" AS ENUM ('GITHUB', 'STRIPE_REVENUE');

-- CreateEnum
CREATE TYPE "WebhookDeliveryStatus" AS ENUM ('FAILED', 'SUCCESS');

-- CreateTable
CREATE TABLE "WebhookDelivery" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "source" "WebhookSource" NOT NULL,
    "eventType" TEXT,
    "status" "WebhookDeliveryStatus" NOT NULL DEFAULT 'FAILED',
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "error" TEXT,
    "shipId" TEXT,
    "nextRetryAt" TIMESTAMP(3),
    "succeededAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WebhookDelivery_projectId_source_idx" ON "WebhookDelivery"("projectId", "source");

-- CreateIndex
CREATE INDEX "WebhookDelivery_source_status_nextRetryAt_idx" ON "WebhookDelivery"("source", "status", "nextRetryAt");
