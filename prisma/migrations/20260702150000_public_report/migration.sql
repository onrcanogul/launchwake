-- AlterTable: public launch report (viral loop) — shareable page per ship.
ALTER TABLE "Ship" ADD COLUMN     "publicToken" TEXT;
ALTER TABLE "Ship" ADD COLUMN     "publicShowRevenue" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "Ship_publicToken_key" ON "Ship"("publicToken");
