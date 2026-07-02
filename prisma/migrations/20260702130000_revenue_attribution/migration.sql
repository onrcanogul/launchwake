-- AlterEnum: attribute revenue, not just signups.
ALTER TYPE "EventType" ADD VALUE IF NOT EXISTS 'REVENUE';

-- AlterTable: revenue amount + currency + recurring flag on events.
ALTER TABLE "Event" ADD COLUMN     "amountCents" INTEGER;
ALTER TABLE "Event" ADD COLUMN     "currency" TEXT;
ALTER TABLE "Event" ADD COLUMN     "recurring" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: per-project Stripe webhook signing secret for revenue attribution.
ALTER TABLE "Project" ADD COLUMN     "stripeWebhookSecret" TEXT;
