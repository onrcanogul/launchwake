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
- **`github.ts`** — repo reads via **either** an OAuth token (public / legacy) **or** a
  GitHub App installation token (private repos); list repos; fetch latest
  release/commit/changelog; verify + handle webhook payloads → create `Ship`. App JWT +
  installation-token minting/caching live here too. See "GitHub integration" below.
- **`onboarding.ts`** — `onboardingConnectMode()`, the pure first-run branch decision
  (picker / connect / manual-first).
- **`llm.ts`** — Anthropic wrapper. Typed prompt functions returning zod-validated JSON.
  Enforces token budget; logs usage.
- **`channels.ts`** — load catalog; `matchChannels(project, ship)` returns candidate channels
  by tag overlap BEFORE the LLM ranks them (constrains the option set).
- **`classify.ts`** — `classifyProduct()`: one small, budget-guarded LLM call that reads WHAT a
  product is (`audience`, `form`, `visualDemo`, `confidence`, `reason`) so the analysis — not
  keyword heuristics alone — decides when short-form channels belong. `classificationToTags()`
  (pure) maps that read to catalog fit-tags. Never invents channels; only gates candidate
  selection. Cached on `Project`; see "Product classification" below.
- **`projectTags.ts`** — `getProjectTagContext(project)`: the ONE place channel-fit context is
  assembled — raw-text heuristics MERGED with the cached/fresh classification tags (via
  `resolveProjectClassification`, which owns the cache + budget guard + heuristic fallback).
  EVERY authenticated `matchChannels` caller routes through it (plan, Channels directory, queue,
  newsletters, subreddit radar) so they all gate short-form channels identically. See below.
- **`analysis.ts`** — `buildPlan(ship)`:
  1. `projectTags.getProjectTagContext()` → matchChannels context (heuristic + classification tags).
  2. `channels.matchChannels()` → candidate set.
  3. LLM ranks candidates for THIS ship/product → fitScore, whyText, ruleNote, bestTime.
  4. banRisk = max(channel.defaultBanRisk, signal from ChannelStat.removals).
  5. persist `DistributionPlan` + `Recommendation[]`.
- **`drafts.ts`** — `generateDraft(recommendation)` → platform-native `Draft` grounded in channel rules.
- **`attribution.ts`** — `createTrackedLink(post)`, `ingest(shortCode, type)`, `rollup(projectId)`.
- **`stats.ts`** — update `ChannelStat` from posts/events (flywheel); used by `analysis` re-ranking.
- **`benchmarks.ts`** — per-(category, channel) `ChannelBenchmark` medians, the paywall trigger. See below.
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

### Product classification — LLM understanding gates short-form channels (`lib/classify.ts`, `lib/projectTags.ts`)

Short-form video channels (TikTok / Reels / Shorts) only work for genuinely visual, consumer
products — a phone app, a game, a design/photo/video tool — never a CLI or a B2B API. Deciding
that from a fixed keyword list is brittle (a bare "mobile" could be a devtool SDK), so the
analysis **classifies the product with the LLM** and lets that read drive candidate selection.
There is **no new user-facing form** — it runs off the fields we already have.

**One shared gate for every surface.** All channel-fit context is assembled in
`projectTags.getProjectTagContext(project)`, and **every** authenticated `matchChannels` caller
routes through it — the distribution plan (`analysis.buildPlan`), the Channels directory
(`catalog.getChannelDirectory`), the sequenced queue (`queue`), newsletter picks (`pitch`), and the
subreddit radar (`radar`). So a consumer/visual product surfaces short-form channels **consistently**
(e.g. TikTok now appears in the Channels directory with its fit score, not just in a plan), and a
devtool has them excluded everywhere. `buildPlan` and the directory classify on a cache miss;
secondary paths (queue/radar/newsletters) are cache-only (`classifyOnMiss: false`) so they never add
an LLM round-trip, but still reuse a cached classification for consistent ranking.

- **One cheap call.** `classifyProduct()` returns strict, zod-validated JSON —
  `{ audience: b2b|b2c|both, form: web|mobile|desktop|cli|library|game, visualDemo, confidence:
  high|low, reason }` — over the product name/description/url + latest ship title/summary, every
  field wrapped in the untrusted-data delimiter. It uses the standard `completeJSON` budget guard
  + `maxTokens` clamp. **On any failure, or when the LLM is unconfigured, it returns `null`** and
  the pipeline falls back to the pure `deriveSignalTags()` heuristic — never a blank plan.
- **The golden rule holds.** The classifier never names or invents a channel. `classificationToTags()`
  (pure, tested) maps the read to catalog fit-tags (`consumer`, `b2c`, `mobile-app`, `game`,
  `desktop`, `visual-demo`); those tags are merged into `matchChannels()`'s signal set, which still
  only ever hands the ranking LLM channels from the seeded catalog.
- **Conservative by construction.** A `confidence: "low"` classification contributes **zero**
  consumer/visual tags, so the short-form fit-gate (`shortformEligible`) stays closed — an ambiguous
  product (or a devtool) is never handed TikTok. This preserves the prior fail-closed default.
- **Cached on `Project`, zero repeat cost.** `resolveProjectClassification` persists the result to
  `Project.classificationJson` with `classifiedAt` and a `classificationHash` = sha256 of
  name+description+url. It re-classifies **only** when that hash changes (the product was edited);
  every later read across any surface reuses the cache and makes no LLM call. Ship title/summary
  enrich the one-time call but are deliberately **not** part of the hash — a product's nature is
  stable across ships.
- **Ranking why-line.** When short-form candidates survive into the candidate set, `buildPlan`
  passes `classification.reason` into the ranking prompt as a `Product read:` line, so the
  format-specific "why" can ground itself in it (e.g. "your product is a visual mobile editor — a
  10-second before/after Reel fits"). It is suppressed when no short-form candidate is present.
- **Public Launch Checker stays heuristic.** The anonymous checker has no `Project` row and never
  classifies — it calls `matchChannels()` without classification tags, so its behavior is unchanged.

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

## Category benchmarks (`lib/benchmarks.ts`)

At the "should I invest in this channel?" moment we show a per-(category, channel) median for the
founder's product bucket. Stored in `ChannelBenchmark`, keyed by `productTag` (a `productTagFor`
bucket like `devtools-backend`) and channel. Two honest, **never-merged** sources, each row
carrying a `source` label — `first-party` | `public` | `blended`:

- **First-party** — median signups per post, aggregated anonymously across all accounts for a
  (category, channel), once ≥ `MIN_FIRST_PARTY_POSTS` tracked posts exist. The real thing.
- **Public bootstrap** — median engagement from **Hacker News (Show HN, Algolia)** and **Product
  Hunt** (token-gated via `PRODUCT_HUNT_TOKEN`) over the **last 90 days**, gated at
  `MIN_PUBLIC_SAMPLE`. Gives a category a defensible number on day one. Reddit medians are
  bootstrapped only for subreddits already present in a real plan/post, never as blanket coverage.

**Cold-start coverage.** `coverageTargets(catalog)` seeds every `COVERAGE_BUCKETS` category (the
`productTagFor` leading segments + `general`) with its top HN/PH launch venues — always including
Show HN — so a brand-new category has a public median before anyone posts. Read paths
(`getBenchmarkMap`) query the exact tag **and** its leading bucket, with exact-tag rows overriding,
so a `devtools-backend` product shows the `devtools` public median at first and switches to its own
first-party/blended row automatically as samples accumulate.

**Network is off the request path.** All fetching lives behind `rollupBenchmarks({ withPublic: true })`,
run only by the daily `/api/cron/benchmarks` cron (best-effort `fetchJson`; never throws). The
plan-build path calls `rollupBenchmarks()` (first-party only, no `withPublic`), and every UI read
(`benchmarkDisplay`, `getBenchmarkMap`, `getCheckerBenchmark`, the state-of-launches board) is a
pure function or an indexed DB read — zero network at request time.

**Display gate & labels.** Rows render below the first-party gate too: `benchmarkDisplay` falls back
to the public number, labelled by its true source — `Public data (HN/PH), last 90 days` — and
switches to signups (blended/first-party) as data lands. Free-plan blur/lock is unchanged (the real
number never reaches a locked client). Surfaces: the plan benchmark strip, the retro "vs median"
column, the public **State of Developer Launches** board, and a one-line Launch Checker teaser
(`getCheckerBenchmark`, served from the precomputed table).

## GitHub integration — two auth sources, one interface

Repo reads (releases, commits, repo metadata → `Ship`s) come from **either** of two
credentials, and every fetcher in `lib/github.ts` takes an optional `accessToken`, so the
two are interchangeable with no behavior change for existing projects:

- **OAuth / public (legacy).** Public repos need no auth; the login OAuth app stays
  profile+email scope only. This is the anonymous **Launch Checker** path and the default
  for existing projects.
- **GitHub App installation (private repos).** A *separate* GitHub App the user **installs**
  (picking which repos to grant on GitHub's own screen) gives **read-only** access —
  **Contents (read) + Metadata**, nothing else: no write, no issues, no PRs. We authenticate
  as the installation via a short-lived RS256 app JWT → an installation access token, cached
  ~50 min (they expire at 60): `generateAppJwt`, `getInstallationToken`,
  `listInstallationRepos`.

**Installation flow.** "Connect GitHub" → the App install URL (`appInstallUrl`) → GitHub →
`/api/github/setup` callback (`parseSetupCallback`). During onboarding (no project yet) the
installation id is bridged in a short-lived httpOnly cookie (`GH_INSTALLATION_COOKIE`); once
a repo is picked it's persisted on `Project.githubInstallationId`. The picker lists
installation repos (public **and** private, private flagged with a lock).

**Onboarding branches** (`onboardingConnectMode`, pure, in `lib/onboarding.ts`):
- *picker* — App installed → repo picker over the granted repos.
- *connect* — signed in with GitHub, App not installed → read-only "Connect GitHub" install
  CTA, manual entry as fallback.
- *manual-first* — email / magic-link user (no GitHub linked) → straight to manual product
  entry (name/url/description) with an **optional** "Connect GitHub for auto-detection" card.
  The wizard always completes without GitHub.

**Webhooks.** App installations deliver release/push events centrally to
`/api/github/webhook` with an `installation` id. Routing maps installation + repo → `Project`
(installation-scoped first, disambiguating the same repo across accounts), falling back to
repo-only for legacy per-project webhooks. Signatures are verified against any applicable
secret — the project's own `webhookSecret`, `GITHUB_APP_WEBHOOK_SECRET`, or the
deployment-wide `GITHUB_WEBHOOK_SECRET` (`verifyWebhookSignatureAny`) — then the delivery
flows through the existing `WebhookDelivery` idempotency + retry pipeline unchanged.

## Security & guards

- No auto-posting anywhere (product principle).
- Verify GitHub + Stripe webhook signatures.
- LLM output strictly validated (zod); reject/repair malformed JSON.
- Entitlement checks server-side before plan generation (Free limits).
- Per-user LLM budget guard.

## Environments

`.env.example` keys: `DATABASE_URL`, `AUTH_SECRET`, `APP_URL`, `AUTH_GITHUB_ID`,
`AUTH_GITHUB_SECRET` (login OAuth), `EMAIL_SERVER`/`EMAIL_FROM` (magic link),
`GITHUB_APP_ID`/`GITHUB_APP_PRIVATE_KEY`/`GITHUB_APP_SLUG`/`GITHUB_APP_WEBHOOK_SECRET`
(installation-based private-repo access), `GITHUB_WEBHOOK_SECRET`, `ANTHROPIC_API_KEY` /
`OPENAI_API_KEY`, `STRIPE_*`, `POLAR_*`, `INNGEST_*`. All third-party keys are optional to
boot (validated in `lib/env.ts`); each feature guards its own at the point of use.
