# CLAUDE.md — instructions for the AI coding agent

You are building **LaunchWake**. Read `/docs` before writing code. This file defines how to work.

## Product in one sentence

A distribution co-pilot for technical founders: for every ship (release/feature/blog),
recommend where to post it, how to do it safely, and attribute the resulting signups.
The moat is the channel-intelligence + outcome data — not post generation.

## Golden rules (do NOT violate)

1. **Never implement auto-posting or bot accounts.** LaunchWake generates drafts and
   plans; the human posts. This is a product principle and a legal/safety one. Any feature
   that posts on the user's behalf is out of scope.
2. **The hero is intelligence, not scheduling.** Prioritize the "Where to post" plan
   (fit score, ban risk, rules, timing) and "Results" (attribution). Drafts are secondary.
   Do not build a generic multi-channel scheduler.
3. **Match the design system exactly** (`docs/DESIGN_SYSTEM.md`). No emoji icons (use SVG
   line icons), no neon gradients/glows, single restrained accent, hairline borders,
   tabular numbers. The look must not read as "AI-generated slop."
4. **Optimize first-run for time-to-first-plan.** Activation = user sees a real
   distribution plan for their own product. Use empty states + a getting-started checklist,
   NOT a slideshow tour. Hide ship-scoped nav until a ship exists (progressive disclosure).

## Conventions

- TypeScript strict. Prefer React Server Components; use Client Components only for interactivity.
- Data access through `/lib` service modules, never inline SQL in components. Prisma only.
- Validation with `zod`. Env vars validated at boot in `/lib/env.ts`.
- Keep business logic (analysis, scoring, attribution) in `/lib`, framework-agnostic and unit-testable.
- Each feature ships with at least one test for its core logic (Vitest).
- Commit style: conventional commits (`feat:`, `fix:`, `chore:`).

## Key modules to build (in `/lib`)

- `lib/github.ts` — OAuth, list repos, fetch releases/commits/changelog, webhook handler → creates `Ship`.
- `lib/llm.ts` — Anthropic client wrapper (typed prompts, JSON output parsing, cost guard).
- `lib/analysis.ts` — given a Ship + Project context, produce a `DistributionPlan`:
  rank channels from the catalog by fit, assign ban risk, best time, rule note, "why".
- `lib/drafts.ts` — generate platform-native drafts per recommended channel.
- `lib/channels.ts` — the channel catalog + rules (seeded), and outcome-based re-ranking.
- `lib/attribution.ts` — tracked link creation, click/signup ingestion, per-channel rollups.
- `lib/billing.ts` — Stripe plans, entitlement checks (Free: 1 project, 2 plans/mo).

## AI/LLM guidance

- All LLM calls go through `lib/llm.ts`. Return strict JSON validated by zod schemas.
- Analysis must ground channel choices in the seeded catalog, not hallucinated communities.
  The LLM ranks/justifies; the catalog constrains the option set. This prevents recommending
  fake subreddits (which get users banned).
- Log token usage; enforce a per-request and per-user budget (cheap guard).

## Definition of done for a screen

- Matches the mock visually (see `/mock`).
- Handles three states: empty, loading, loaded (and error where relevant).
- Responsive: sidebar collapses to a drawer under 880px; content centered, max-width ~1160px.
- No console errors; a11y basics (labels, focus states, keyboard nav).

## Commands

```bash
pnpm dev            # run
pnpm prisma migrate dev
pnpm test           # vitest
pnpm lint && pnpm typecheck
```
