-- AlterEnum: add the seat-based Team tier.
ALTER TYPE "Plan" ADD VALUE IF NOT EXISTS 'TEAM';

-- AlterTable: purchased seats (Team plan; billed per seat).
ALTER TABLE "User" ADD COLUMN     "seats" INTEGER NOT NULL DEFAULT 1;
