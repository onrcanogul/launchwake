# Roadmap — LaunchWake

Build order optimized for a solo builder using AI tooling. Ship the hero (Where to post)
early; defer everything not on the critical path to first value.

## Milestone 0 — Scaffold (2–3 days)
- Next.js 15 + TS + Tailwind v4; base UI kit from DESIGN_SYSTEM.md (tokens, Button, Panel, Badge, Icon).
- Prisma + Supabase; run schema from DATA_MODEL.md; seed ~20 channels with rules/tags/times.
- Auth.js with GitHub OAuth + email. Protected `/app`.
- `.env.example`, `lib/env.ts`, `lib/db.ts`.
- Port the static mock into real routed pages (visual parity).

## Milestone 1 — The hero loop (week 1–2)  ← most important
- `lib/github.ts`: connect repo, fetch latest release/commit (manual pull, no webhook yet).
- Onboarding: connect product (URL or GitHub) → create Project.
- `lib/channels.ts` `matchChannels()` + `lib/llm.ts` + `lib/analysis.ts` `buildPlan()`.
- **New ship → Where to post plan** rendered (fit, ban risk, time, why, rule). This is the aha.
- `lib/drafts.ts` → Launch kit drafts per channel (copy button).
- Empty states + getting-started checklist + progressive nav.
**Exit criteria:** a new user connects their product and sees a real, grounded distribution
plan + drafts within one session.

## Milestone 2 — Close the loop (week 3)
- Record a Post (user confirms they posted) + `TrackedLink`.
- `/r/[code]` redirect + click ingest; signup pixel + `/api/track/signup`.
- Results screen: per-channel clicks/signups/conversion + one insight line.
- Ship feed becomes real (recent ships + month stats).

## Milestone 3 — Monetize + retain (week 4)
- Stripe: Free (1 project, 2 plans/mo) vs Pro ($29/mo). Entitlement checks.
- Channels library view.
- Polish, loading skeletons, error states, a11y pass, mobile QA.
**Exit criteria:** a user can hit the free limit and upgrade; billing works end-to-end.

## Milestone 4 — The flywheel + auto-detect (v0.2)
- GitHub webhook → auto-create ships → Ship feed populates continuously (drives retention).
- `lib/stats.ts` ChannelStat rollups from real outcomes → outcome-based re-ranking in `analysis`.
- Scheduling reminders (post at best time) — reminders only, never auto-post.
- Inngest for async analysis + rollups.

## Later
- Expand channel catalog + niche communities; team/agency multi-project; Slack alerts on new ship;
  content-calendar view; light theme.

## Guardrails carried through every milestone
- Never auto-post. Hero = intelligence + attribution, not scheduling.
- Constrain LLM channel choices to the seeded catalog (no invented communities).
- Match the design system; no AI-slop tells.
- First-run always leads to a plan; no blank screens (empty states everywhere).

## First code task for the agent
> Scaffold Milestone 0, then implement Milestone 1 end-to-end for a single hard-coded
> example project ("Hookline"), using the seeded channel catalog and a real Claude call in
> `lib/analysis.ts`. Render the Where-to-post plan matching `/mock/launchwake-app.html`.
