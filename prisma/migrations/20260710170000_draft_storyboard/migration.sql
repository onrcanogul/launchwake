-- Short-form video concept for a draft. For TikTok/Instagram Reels/YouTube Shorts
-- the draft is a shootable storyboard, not just text: { hook, beats[],
-- onScreenText[], sound }. Nullable and additive — existing text-channel drafts
-- keep the whole draft in `body` and leave this null.

-- AlterTable
ALTER TABLE "Draft" ADD COLUMN     "storyboard" JSONB;
