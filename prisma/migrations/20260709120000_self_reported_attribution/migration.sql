-- AlterTable: LaunchWake's own signup self-report ("how did you hear about us?")
ALTER TABLE "User" ADD COLUMN     "heardVia" TEXT,
ADD COLUMN     "heardViaAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SelfReport" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "platform" "Platform",
    "lwRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SelfReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SelfReport_projectId_createdAt_idx" ON "SelfReport"("projectId", "createdAt");

-- AddForeignKey
ALTER TABLE "SelfReport" ADD CONSTRAINT "SelfReport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
