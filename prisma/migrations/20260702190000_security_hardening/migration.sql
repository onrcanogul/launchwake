-- CreateTable
CREATE TABLE "RateWindow" (
    "id" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "resetAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateWindow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LlmUsageDay" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "tokens" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LlmUsageDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessedStripeEvent" (
    "eventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedStripeEvent_pkey" PRIMARY KEY ("eventId")
);

-- CreateIndex
CREATE INDEX "RateWindow_resetAt_idx" ON "RateWindow"("resetAt");

-- CreateIndex
CREATE INDEX "LlmUsageDay_day_idx" ON "LlmUsageDay"("day");

-- CreateIndex
CREATE UNIQUE INDEX "LlmUsageDay_userId_day_key" ON "LlmUsageDay"("userId", "day");

