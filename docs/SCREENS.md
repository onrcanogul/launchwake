# Screens & UX — LaunchWake

Visual source of truth: `/mock/launchwake-app.html` (app) and `/mock/launchwake.html` (landing).
Match them. Every screen must handle **empty / loading / loaded** states.

## Design principle for first-run

Activation = user sees a **real distribution plan for their own product**. Optimize the first
session for time-to-first-plan. Do **not** use a slideshow tour (devs skip it). Use:
- a focused onboarding that ends in the first plan,
- self-explaining **empty states**,
- **progressive disclosure** (hide ship-scoped nav until a ship exists),
- a small **getting-started checklist** on the dashboard.

## Navigation

Sidebar groups:
- **Workspace:** Ship feed, New ship, Channels
- **Ship · {name}** (contextual, only when a ship is selected): Where to post, Launch kit, Results
- Bottom: Settings, user + plan

Top bar: breadcrumb, search (⌘K). Under 880px: sidebar → drawer via hamburger.

## Screens

### 0. Login (`/login`)
- Centered card, wave motif. "Continue with GitHub" (primary — needed for repo connect), email magic link.
- GitHub is the recommended path (enables auto-detect later).

### 1. Onboarding (`/onboarding`) — 3-step wizard (`OnboardingWizard`)
- **Step 1 — Connect:** a **GitHub repo picker** (searchable dropdown over the user's public
  repos via their OAuth token), with fallbacks to manual `owner/repo` and fully-manual product
  entry (name/URL/description) for email-auth users. Picking a repo prefills name/description/URL.
  A "Private repo? Coming soon via GitHub App" note captures interest via the `Lead` model.
- **Step 2 — Launch stage (required):** "Has this product had a public launch?" →
  `Project.launchStage` (`Not live yet` = PRE_LAUNCH, `Live but never launched` = UNANNOUNCED,
  `Already launched` = LAUNCHED).
- **Step 3 — Review & start.** Branches on launch stage:
  - `PRE_LAUNCH` / `UNANNOUNCED` → creates a LAUNCH ship and routes into **Launch Mode**
    (readiness stage).
  - `LAUNCHED` → **Growth Mode**: creates the first ship from the repo (or a synthetic launch),
    builds its plan, and lands on **Where to post** (the aha).

### 1b. Launch Mode (`/app/ships/[id]/{readiness,plan,kit,schedule,launch,retro}`)
A guided first-launch path for PRE_LAUNCH/UNANNOUNCED products, tied together by the
`LaunchModeRail` stepper (shown on every stage). Stages:
1. **Readiness** — weighted setup score + `Checklist` (tracking snippet heaviest) with the
   `TrackingSetup` card. `lib/launchReadiness.ts` + `lib/launchMode.ts`.
2. **Where to post** — the plan page, launch-aware ranking (`launchContext` boosts PH/Show HN/
   launch communities). Free plans launch on `FREE_LAUNCH_CHANNELS`, the rest locked (paywall).
3. **Launch kit** — drafts per channel (through tracked links).
4. **Schedule** — pick a launch date → D-7..D+2 timeline (`lib/launchSchedule.ts`), multi-event
   ICS (`/api/ics/launch/[shipId]`), and a D-1 `Reminder`.
5. **Launch day** — the cockpit (`LaunchDay`): ordered copy-and-mark-posted queue + live signup
   strip (`RoiStrip`). Human posts; never auto-posts.
6. **Retro** — D+1: per-channel attribution vs the category `ChannelBenchmark` median, share via
   the white-label report + `PoweredBy`, then **Complete launch** → `launchStage = LAUNCHED`
   (Growth Mode) with GitHub-webhook / digest loop setup.

### 2. Ship feed (`/app`) — dashboard, continuous
- **Empty state:** "No ships yet. Connect GitHub or add your first ship — we'll show you where
  to take it." + primary CTA + getting-started checklist (Connect GitHub ✓ / Analyze first ship /
  Post it / See results).
- **Loaded:** month stats (reach, signups, ships distributed, best channel) + "Recent ships" list.
  Each ship row: type tag (LAUNCH/FEATURE/BLOG), title, meta, status/result badge
  ("Get plan →" if not distributed; "N signups" if done).

### 3. New ship (`/app/ships/new`)
- Segmented input: From GitHub (pick commit/release) / Paste URL / Describe.
- Optional "what makes this worth sharing" context box.
- CTA: "Build distribution plan" → runs analysis → Where to post.
- Safety note: never auto-posts.

### 4. Where to post (`/app/ships/[id]/plan`) — HERO SCREEN
- Header names the ship being distributed.
- List of channel cards, ranked by fit. Each card:
  - icon + name + audience, right-aligned **fit score** (meter + number),
  - one-line "why this channel for this ship",
  - footer meta: **ban risk** (Low/Med/High dot), **best time**, **rule** (the safe way in),
  - "Get draft" → Launch kit for that channel.
- **Loading state:** skeleton + "Analyzing where your users are…" (the perceived-magic moment).

### 5. Launch kit (`/app/ships/[id]/kit`)
- Platform tabs (Show HN, X, r/webdev, LinkedIn, Product Hunt…).
- Each tab: a draft card (copyable body) + a **safety/tactic note** (e.g., "link in first comment").
- Reinforce: you post this yourself.

### 6. Channels (`/app/channels`) — the intelligence asset
- Table of relevant channels: name, fit, ban risk, best time, **your signups there** (history).
- **Empty state:** explains it fills once you connect a product / distribute a ship.
- Note that the map sharpens over time (the flywheel) — sets the moat expectation.

### 7. Results (`/app/results`)
- Table across all ships: channel, ship, clicks, signups, conversion (mini bar).
- One "What LaunchWake sees" insight line (LLM summary: double down / avoid).
- **Empty state:** "Post your first ship and add the tracking pixel to see what converts."

### 8. Settings (`/app/settings`)
- Connections (GitHub, product URL, signup tracking pixel, Slack).
- Plan (Free limits + Upgrade to Pro $29/mo).

## Empty-state copy (write these, don't leave blank screens)

| Screen | Empty message | CTA |
|--------|---------------|-----|
| Ship feed | "No ships yet — connect GitHub or add one." | Connect GitHub / New ship |
| Where to post | (only reachable with a ship) | — |
| Channels | "Connect a product; we'll map your communities." | Go to onboarding |
| Results | "No data yet — post a ship and add the pixel." | Set up tracking |

## Responsive rules

- ≥ 880px: fixed sidebar + centered content (max-width ~1160px).
- < 880px: sidebar becomes a slide-in drawer (hamburger); stats stack; tables scroll-x; search hidden.
- < 480px: stat cards single column.
