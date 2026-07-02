-- AlterEnum: add channel platform categories for the expanded catalog
-- (Discord/Slack communities, newsletters, directories, social, forums, blogs).
ALTER TYPE "Platform" ADD VALUE IF NOT EXISTS 'DISCORD';
ALTER TYPE "Platform" ADD VALUE IF NOT EXISTS 'SLACK';
ALTER TYPE "Platform" ADD VALUE IF NOT EXISTS 'NEWSLETTER';
ALTER TYPE "Platform" ADD VALUE IF NOT EXISTS 'DIRECTORY';
ALTER TYPE "Platform" ADD VALUE IF NOT EXISTS 'MASTODON';
ALTER TYPE "Platform" ADD VALUE IF NOT EXISTS 'BLUESKY';
ALTER TYPE "Platform" ADD VALUE IF NOT EXISTS 'FORUM';
ALTER TYPE "Platform" ADD VALUE IF NOT EXISTS 'YOUTUBE';
ALTER TYPE "Platform" ADD VALUE IF NOT EXISTS 'BLOG';
