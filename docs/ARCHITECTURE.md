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
  posts the `lw_ref` back to `/api/track/signup`, or a server-side `fetch` (the "Backend"
  snippet, no SDK). Keep it optional; clicks work without integration, signups need the pixel.

### Reconciled Results — tracked vs reported (honest, never merged)

There are two independent measurement systems and they answer different questions, so we show
them side by side and **never merge them into one "exact" number** (`reconcileAttribution`,
pure, in `lib/selfReport.ts`; assembled by `getReconciledResults`):

- **Tracked** — link-attributed `SIGNUP` events. Verifiable, and the only signal the moat uses.
- **Reported** — "how did you hear about us?" survey answers, normalized to a catalog **platform**
  by a pure matcher (`normalizeSource`: `"hn"`/`"hacker news"` → `hackernews`, and Turkish
  free text like `"bir arkadaşım tavsiye etti"` → word-of-mouth, since the survey runs on the
  customer's site in their language). Self-reported → unverifiable.

The reconciliation unit is the **platform** (a coarse answer says "Reddit", not "r/webdev"), so
multiple channels on one platform sum without double-counting an answer. Each row carries a
blended **confidence** label — `HIGH` (tracked + reported agree), `MEDIUM` (one source only),
`LOW` (combined sample < 5) — and totals reconcile *within* each system (attributed + remainder).

- **Dark social / unknown** gets its own row: unattributed tracked signups + survey answers with
  no channel (word-of-mouth, podcast, search…), with a factual explainer (~85% of sharing is
  untrackable industry-wide — normal, not a tracking failure). Honesty is the brand feature.
- **Moat stays tracked-only.** `ChannelStat.signups` / `outcomeEvidence` use tracked signups; a
  new `ChannelStat.reportedSignups` stores the survey counts *alongside* (split evenly across a
  project's channels on a platform, floored — never inflating) so benchmarks can show both later.

### Capture resilience (fewer lost conversions)

The gap between a real conversion and an attributed one is where founders lose trust in the
numbers. Four mechanisms close it; the pure parts (`mergeTouches`/`sanitizeTouches`, the health
rules) are unit-tested.

- **Persistence — two carriers, 90 days.** The `/r` redirect sets an `lw_ref` cookie (90d,
  `SameSite=Lax`). The pixel mirrors the ref into a first-party cookie *and* localStorage (90d
  expiry) on the product domain, and reads cookie-then-localStorage at signup — so clearing one
  store doesn't lose the attribution.
- **Multi-touch (last-3).** The pixel keeps up to the last 3 distinct `lw_ref` codes
  (most-recent first) and sends them all. The SIGNUP is attributed **last-touch** (`touches[0]`);
  the rest are kept in `Event.meta.touches` for future multi-touch modeling. `mergeTouches` (the
  merge rule) is shared: the pure server helper and the inline snippet apply the same logic.
- **Cross-device recovery (optional).** When a personalized link passes an email —
  `/r/{code}?eh=<sha256>` (preferred) or `?email=` — the CLICK stores an `Event.emailHash`
  (never the raw email). A later signup that arrives with **no** `lw_ref` but the same email is
  recovered to that channel via `findClickByEmailHash`. Off unless the destination passes an email.
- **Unattributed reconciliation.** A signup with no ref and no email match is still recorded —
  `trackedLinkId = null`, `projectId` set, `meta.channel = "unattributed"` — so total signups
  reconcile and the dark-social share is measurable rather than silently dropped. Link-less rows
  dedupe via a second partial unique index `(projectId, type, dedupeKey) WHERE trackedLinkId IS NULL`.

### Tracking health (`lib/trackingHealth.ts`)

`deriveTrackingHealth` (pure) turns raw signals into per-item status + one-line fixes, surfaced
in the Settings tracking-health panel. Beyond the webhook items it flags: **pixel never fired**
(the verification ping never arrived), **clicks but zero signups for 14+ days** (a silent pixel
failure, escalated by click age), and the **dark-social share** (unattributed ÷ total signups —
amber past 40%, nudging the "How did you hear about us?" survey).

### Data-integrity guards (attribution)

A founder trusts these numbers to pick channels, so a padded count is worse than a missing
one. Four guards keep the signal clean; the pure logic lives in `/lib` and is unit-tested.

- **Idempotent CLICK/SIGNUP.** Every recorded click/signup carries an `Event.dedupeKey`; a
  *partial* unique index `(trackedLinkId, type, dedupeKey) WHERE dedupeKey IS NOT NULL`
  makes a re-fire a no-op. Keys (see `lib/attribution.ts`):
  - CLICK — `sha256(ipHash + userAgent + shortCode + UTC-day)` → one click per visitor/link/day.
  - SIGNUP — `sha256(lowercased email)` when the pixel/beacon supplies one (strongest
    identity), else the same ip-based key. Email is hashed server-side, never stored.
  - Writes use `createMany({ skipDuplicates })` → a single `INSERT … ON CONFLICT DO NOTHING`.
    On conflict the insert is silently skipped (no error to the caller), and the `/r`
    redirect keeps its one-lookup-plus-one-write latency profile.
- **Bot / prefetch filtering** (`lib/botDetection.ts` `isLikelyBot`). `/r/[code]` and every
  `/api/track/*` endpoint still redirect / return `200`, but *skip recording* for known
  crawler/spider/preview/headless user-agents, a missing user-agent, and prefetch hints
  (`Purpose: prefetch`, `Sec-Purpose`, `X-Moz: prefetch`, `X-Purpose: preview`).
- **Tenant scoping.** `ingestSignup` / `ingestRevenue` take an optional `projectId`. A caller
  with a *verified* project context (the per-project Stripe webhook `/api/track/stripe/{projectId}`,
  authenticated server actions) passes it, and a link whose `post.ship.projectId` doesn't
  match is refused with a captured warning — no cross-tenant writes. Public pixel calls carry
  only the short code, so they stay global (and rate-limited).
- **Revenue trust (`Event.verified`).** Amounts are client-supplied. `/api/track/revenue`
  marks revenue `verified=true` only when the request carries a valid `x-lw-signature`
  (HMAC-SHA256 of the raw body, keyed by the project's `webhookSecret`); unsigned/invalid
  calls are still recorded as `verified=false` rather than trusted. Signature-verified server
  paths (the Stripe webhook, LaunchWake's own billing/Polar) record `verified=true`. Results
  sums verified revenue separately (`totalVerifiedRevenueCents`) so a spoofable figure never
  inflates the trusted headline.

## Security & guards

- No auto-posting anywhere (product principle).
- Verify GitHub + Stripe webhook signatures.
- LLM output strictly validated (zod); reject/repair malformed JSON.
- Entitlement checks server-side before plan generation (Free limits).
- Per-user LLM budget guard.

## Environments

`.env.example` keys: `DATABASE_URL`, `NEXTAUTH_SECRET`, `GITHUB_ID`, `GITHUB_SECRET`,
`ANTHROPIC_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `INNGEST_*`, `APP_URL`.
