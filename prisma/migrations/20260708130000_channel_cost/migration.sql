-- Add optional per-channel cost data ({ type: free|paid|freemium, note? }).
-- Absent = free. Shape validated in application code by lib/channelCost.ts
-- (ChannelCostSchema). Surfaces the plan-card cost badge + the analysis prompt.
ALTER TABLE "Channel" ADD COLUMN "cost" JSONB;
