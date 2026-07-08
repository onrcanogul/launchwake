# LaunchWake

> Marketing intelligence for founders who'd rather be coding.
> **Ship it. We'll make the waves.**

LaunchWake is a distribution co-pilot for technical founders. Every time you ship
something — a release, a feature, a changelog entry, a blog post — LaunchWake tells
you **where** to talk about it, **how** to post it without getting banned, and shows
you **what actually drove signups**. It does the analysis and drafting; **you press
publish** (no auto-posting, no bot accounts).

## Why it exists

Technical founders can build anything but stall at distribution. The painful, unsolved
job is not "write a post" (ChatGPT does that free) — it's:

1. Knowing **which communities** fit this specific product, and each one's **rules**.
2. Not **getting your accounts banned** (Reddit wiped ~70% of auto-posting accounts in 2025).
3. Knowing **which channel actually converted**, so you can do more of it.

LaunchWake owns that intelligence layer. Post drafting is the last-mile convenience wrapped around it.

## Positioning (important)

Not a "launch tool" (launches are rare → weak retention). It is an **every-ship**
distribution engine: each ship is a distribution moment, so usage — and value — is continuous.
Do **not** let it drift into a social-media scheduler (Buffer/Hypefury); the hero is the
**intelligence** (where + rules + ban-safety + ROI), not scheduling.

## The core loop

```
Ship detected/added  →  Analyze (fit + channels)  →  Where to post (plan)  →
Launch kit (drafts you post yourself)  →  Track links  →  Results (attribution)  →
Outcome data improves future recommendations (moat flywheel)
```

## Tech stack

| Layer        | Choice |
|--------------|--------|
| Framework    | Next.js 15 (App Router, RSC), TypeScript (strict) |
| Styling      | Tailwind CSS v4 + small custom UI kit (see DESIGN_SYSTEM.md) |
| DB           | PostgreSQL (Supabase) via Prisma |
| Auth         | Auth.js (NextAuth) — GitHub OAuth primary, email magic link |
| AI           | Anthropic Claude API (analysis + draft generation) |
| Jobs         | Inngest (GitHub ship detection, async analysis) — inline for MVP is OK |
| Payments     | Stripe (Free + Pro $29/mo) |
| Hosting      | Vercel + Supabase |

## Repo layout

```
/app            Next.js routes (App Router)
/components     UI components (see DESIGN_SYSTEM.md)
/lib            Core logic: analysis engine, channel intel, attribution, github, llm
/prisma         schema.prisma + migrations
/docs           Specs — READ THESE FIRST
/public
```

## Docs — read in this order

1. `docs/PRD.md` — what we're building and for whom.
2. `docs/SCREENS.md` — every screen, states, first-run/onboarding.
3. `docs/DATA_MODEL.md` — schema and entities.
4. `docs/ARCHITECTURE.md` — services, data flow, integrations.
5. `docs/DESIGN_SYSTEM.md` — tokens and components (match the mock exactly).
6. `docs/ROADMAP.md` — build order / milestones.

A static, clickable HTML mock of the full UI exists at `/mock/launchwake-app.html`
and the landing at `/mock/launchwake.html`. Treat them as the visual source of truth.

## Getting started (once scaffolded)

```bash
pnpm install
cp .env.example .env.local   # fill in keys
pnpm prisma migrate dev
pnpm db:seed                  # REQUIRED: seed the channel catalog — the app can't build a plan without it
pnpm dev
```

> The channel catalog (`Channel` table) is the product's intelligence asset, not fixture
> data. Skipping `db:seed` leaves it empty, and "Build distribution plan" fails with
> _"The channel catalog is empty — run `pnpm db:seed`"_. `seed.ts` upserts, so re-running
> is safe. For a prod deploy, seed the production DB too — see `docs/GO_LIVE.md` §2.5.
