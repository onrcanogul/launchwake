-- Store self-reported signups alongside tracked signups on the channel-outcome
-- rollup (the moat). Additive + defaulted, so existing rows are unaffected. The
-- ranking/outcome logic keeps using `signups` (tracked) only — `reportedSignups`
-- is unverifiable survey data, kept for future "tracked vs reported" benchmarks.
ALTER TABLE "ChannelStat" ADD COLUMN "reportedSignups" INTEGER NOT NULL DEFAULT 0;
