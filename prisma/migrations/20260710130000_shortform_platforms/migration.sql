-- AlterEnum: add short-form video platforms for the short-form channel pack
-- (TikTok + Instagram Reels, alongside the existing YouTube used for Shorts).
ALTER TYPE "Platform" ADD VALUE IF NOT EXISTS 'TIKTOK';
ALTER TYPE "Platform" ADD VALUE IF NOT EXISTS 'INSTAGRAM';
