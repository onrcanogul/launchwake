-- AlterTable: track the last weekly digest send (guards against re-sends).
ALTER TABLE "User" ADD COLUMN     "lastDigestAt" TIMESTAMP(3);
