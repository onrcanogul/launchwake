# Architecture — LaunchWake

## Overview

Next.js (App Router) monolith on Vercel, Postgres on Supabase, async jobs via Inngest,
Claude for analysis/drafting, Stripe for billing. Business logic lives in `/lib` and is
framework-agnostic so it can be unit-tested and reused by jobs and routes alike.

```
Browser ──> Next.js (RSC + Route Handlers) ──> /lib services ──> Postgres (Prisma)
                     │                              │
                     │                              ├─> Anthropic Claude (analysis, drafts)
                     │                              ├─> GitHub API (repos, releases, webhooks)
                     │                              └─> Stripe (billing)
                     └─> Inngest (ship detection, async analysis, stat rollups)
Tracked link clicks ──> /r/[code] route ──> Event ingest ──> attribution rollups
```

## Modules (`/lib`)

- **`env.ts`** — zod-validated env vars.
- **`db.ts`** — Prisma client singleton.
- **`auth.ts`** — Auth.js config (GitHub provider + email). Session helpers.
- **`github.ts`** — OAuth token use; list repos; fetch latest release/commit/changelog;
  verify + handle webhook payloads → create `Ship`.
- **`llm.ts`** — Anthropic wrapper. Typed prompt functions returning zod-validated JSON.
  Enforces token budget; logs usage.
- **`channels.ts`** — load catalog; `matchChannels(project, ship)` returns candidate channels
  by tag overlap BEFORE the LLM ranks them (constrains the option set).
- **`analysis.ts`** — `buildPlan(ship)`:
  1. `channels.matchChannels()` → candidate set.
  2. LLM ranks candidates for THIS ship/product → fitScore, whyText, ruleNote, bestTime.
  3. banRisk = max(channel.defaultBanRisk, signal from ChannelStat.removals).
  4. persist `DistributionPlan` + `Recommendation[]`.
- **`drafts.ts`** — `generateDraft(recommendation)` → platform-native `Draft` grounded in channel rules.
- **`attribution.ts`** — `createTrackedLink(post)`, `ingest(shortCode, type)`, `rollup(projectId)`.
- **`stats.ts`** — update `ChannelStat` from posts/events (flywheel); used by `analysis` re-ranking.
- **`billing.ts`** — Stripe checkout/portal; `assertEntitlement(user, action)`.

## Route structure (App Router)

```
/app
  /(marketing)/page.tsx              → landing (or serve separate)
  /(auth)/login/page.tsx
  /onboarding/page.tsx               → connect product → first plan
  /app/page.tsx                      → Ship feed (dashboard)
  /app/ships/new/page.tsx            → New ship
  /app/ships/[id]/plan/page.tsx      → Where to post (plan)
  /app/ships/[id]/kit/page.tsx       → Launch kit
  /app/channels/page.tsx             → Channels library
  /app/results/page.tsx              → Results
  /app/settings/page.tsx
  /api/github/webhook/route.ts       → ship auto-detect
  /api/stripe/webhook/route.ts
  /api/inngest/route.ts
  /r/[code]/route.ts                 → tracked-link redirect + click ingest
  /api/track/signup/route.ts         → signup pixel/callback ingest
```

## Analysis pipeline (the important one)

1. Ship arrives (manual or webhook) → `status = NEW`.
2. `analysis.buildPlan(ship)` runs (inline for MVP, Inngest job for v0.2).
3. Candidate channels selected from catalog by tag overlap (NOT free-form LLM invention).
4. Claude ranks + justifies each candidate for this specific ship & product context.
5. Plan persisted; ship → `PLANNED`. UI shows "Where to post".
6. User generates drafts on demand (`drafts.generateDraft`).
7. User posts manually → records a `Post` (+ tracked link).
8. Clicks/signups ingest → `Event` → `stats` rollup → future plans re-ranked.

## Attribution

- Each `Post` gets a `TrackedLink` (`/r/{shortCode}` → destUrl with UTM).
- `/r/[code]` logs a CLICK then 302-redirects.
- Signup attribution: lightweight — either a JS pixel on the product's thank-you page that
  posts the `lw_ref` cookie back to `/api/track/signup`, or a server-side callback. Keep it
  optional; clicks work without integration, signups require the pixel.

## Security & guards

- No auto-posting anywhere (product principle).
- Verify GitHub + Stripe webhook signatures.
- LLM output strictly validated (zod); reject/repair malformed JSON.
- Entitlement checks server-side before plan generation (Free limits).
- Per-user LLM budget guard.

## Environments

`.env.example` keys: `DATABASE_URL`, `NEXTAUTH_SECRET`, `GITHUB_ID`, `GITHUB_SECRET`,
`ANTHROPIC_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `INNGEST_*`, `APP_URL`.
