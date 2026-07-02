-- CreateTable
CREATE TABLE "ChannelBenchmark" (
    "id" TEXT NOT NULL,
    "productTag" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "sampleSize" INTEGER NOT NULL DEFAULT 0,
    "medianSignups" INTEGER NOT NULL DEFAULT 0,
    "meanSignups" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "conversionPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "publicSample" INTEGER NOT NULL DEFAULT 0,
    "medianUpvotes" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'public',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelBenchmark_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChannelBenchmark_productTag_idx" ON "ChannelBenchmark"("productTag");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelBenchmark_productTag_channelId_key" ON "ChannelBenchmark"("productTag", "channelId");

-- AddForeignKey
ALTER TABLE "ChannelBenchmark" ADD CONSTRAINT "ChannelBenchmark_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
