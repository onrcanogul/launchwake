-- CreateEnum
CREATE TYPE "LaunchStage" AS ENUM ('PRE_LAUNCH', 'UNANNOUNCED', 'LAUNCHED');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "launchStage" "LaunchStage" NOT NULL DEFAULT 'LAUNCHED',
ADD COLUMN     "launchReadinessJson" JSONB,
ADD COLUMN     "launchReadinessAt" TIMESTAMP(3);
