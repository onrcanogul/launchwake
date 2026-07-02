-- AlterTable: cached post-mortem coaching (LLM diagnosis grounded in outcomes).
ALTER TABLE "Post" ADD COLUMN     "coachingJson" JSONB;
ALTER TABLE "Post" ADD COLUMN     "coachedAt" TIMESTAMP(3);
