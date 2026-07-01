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

### 1. Onboarding (`/onboarding`)
- Step indicator. One job: connect the product.
- Options: **Connect GitHub repo** (recommended, auto-detect ships), Add product URL, Connect changelog/blog RSS (optional).
- Ends with **"Analyze my latest ship"** → runs analysis → lands on the first **Where to post** plan
  (the aha). If nothing to analyze yet, land on Ship feed with the checklist.

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
