# Channel access & readiness — personalize the plan to what the founder can actually do

> Status: **proposed** (spec). Origin: dogfooding LaunchWake's own launch on
> 2026-07-08. Related: `lib/accountReadiness.ts`, self-reported attribution
> (`lib/selfReport.ts`), `docs/PRD.md`.

## Problem

The distribution plan ranks channels by fit and warns, in launch mode, whether
there's enough **runway** to prepare a credible account (`computeAccountReadiness`
uses the launch date + the channel's `accountRequirements`). But it never asks
the one thing that actually decides whether a founder can act today: **what
access and standing do they already have on each channel?**

Concretely, dogfooding the IH launch, IndieHackers blocked post creation outright
— *"You can't create posts yet"* (post privileges are earned via authentic
comments, or bought via IH Plus). The plan happily recommended IH anyway, and a
fresh dogfood account hits similar walls on Lobsters (invite + 70 days) and
karma-gated subreddits. The felt experience: *"then we can't post anywhere."*

That reaction is wrong but understandable. The truth is a **spectrum**:

- **Blocked** — the platform refuses the post from this account (IH post gate,
  Lobsters invite, some subreddit karma gates).
- **Low reach** — you *can* post (owned channels: X, LinkedIn, Bluesky,
  Mastodon, your blog/newsletter) but a cold account gets little reach.
- **Open** — submit and go (most directories; PH with prep; dev.to/Hashnode).

The plan should make this spectrum obvious **per user**, and lead with what they
can do *now* — while showing the high-value gated channels with a prepare-path,
not hiding them.

## What we already model vs. what's missing

- **Channel requirement (exists):** `accountRequirements` on each catalog entry
  (`level`, `minAccountAgeDays`, `minKarmaOrReputation`, `sourceNote`,
  `profileTips`). "What this channel demands."
- **Timing readiness (exists):** `computeAccountReadiness(reqs, { launchAt, now })`
  → at-risk warning + a small fit penalty when the launch is too soon to prepare.
- **Missing:** the founder's **own** access/standing. Readiness today reasons
  only about *lead time*, never about *what you already have*.

The formula we want:

```
channel requires  +  user has  =  per-user status: post-now | warm-up | blocked
```

## Principle guardrails (do not violate)

- **Self-report only.** We ASK the founder; we never inspect, verify, or log into
  their accounts, and we never post for them (golden rule #1). Same philosophy as
  self-reported attribution — the human is the source of truth and the actor.
- **Never invent thresholds.** IH's gate is *non-numeric* (earned privilege / IH
  Plus). Don't fabricate a `minAccountAgeDays` to force a penalty — extend the
  model to express qualitative gates (below).
- **Protect time-to-first-plan (principle #4).** No heavy "answer 20 questions
  about your accounts" onboarding. Capture is lightweight and progressive.
- **Segment, don't hide.** Gated high-value channels stay visible with a
  prepare-path; we reorder and label, we don't remove.

## Proposed model

### 1. User access profile (new, self-reported)

Account/user-scoped (a founder's X handle / Reddit account / IH standing is the
same across all their projects). A team "who will post" question is out of scope
for v1.

Coarse, high-signal, per **platform** (mirrors self-report's Platform taxonomy —
people think "Reddit", not "r/webdev"), with a few channel-specific gates:

```
ChannelAccess (per user, per platform/channel key)
  key        e.g. "reddit" | "indiehackers" | "lobsters" | "x" | "hackernews"
  standing   "none" | "building" | "established"   // self-reported
  audience?  coarse bucket for owned channels: none | small | mid | large
  note?      free text (optional)
  updatedAt
```

- Owned platforms (X, LinkedIn, Bluesky, Mastodon, blog/newsletter): capture
  `audience` bucket → drives "low reach" vs "good reach", never "blocked".
- Gated communities (IH, Lobsters, karma subreddits, HN): capture `standing` →
  maps to the catalog's requirement to produce post-now / warm-up / blocked.

### 2. Readiness engine extension

`computeAccountReadiness` gains an optional `access?: ChannelAccess` input and a
way to express **non-numeric hard gates** on the requirement side, e.g.:

```
accountRequirements.gate?: "earned-privilege" | "invite" | "domain-verify"
```

Resulting per-channel `access status`:

- `blocked` — requirement is a hard gate (numeric age/karma unmet, or a
  qualitative gate) AND the user's standing is `none`/`building`.
- `warm-up` — gated but the user is actively building, or launch runway is short.
- `post-now` — open channel, or the user reports `established` standing.

`blocked` replaces today's silent "at-risk penalty only" for cases the user has
told us they can't act on, and can drop the channel below the post-now set.

### 3. Capture UX (progressive, not upfront)

1. First plan still renders instantly. Unknown gated channels default to the
   **safe** side ("prepare first"), so the plan is honest with zero input.
2. On each plan card for a gated channel, a one-tap control:
   *"I can post here · I'm warming up · No access yet"* → writes `ChannelAccess`
   and personalizes ranking/segmentation from then on.
3. Optional: a tiny one-time "Where do you already have a foothold?" step
   (owned-channel audience buckets + "any aged Reddit account?") — offered, never
   blocking.

### 4. Plan segmentation (Phase 1 deliverable)

Split the ranked recs into labeled groups on the plan page:

- **Post now** — open + established-standing channels (lead here).
- **Warm up first** — gated channels with a concrete prepare-path (the readiness
  tips + lead-time hint we already compute).
- **No access yet** — hard-blocked for this account (collapsed by default).

Keeps the full ranking; just reorders + labels by access status.

## Phasing

- **Phase 0 (done 2026-07-08):** correct the IH catalog entry — `level: "required"`
  + grounded sourceNote/tips (`prisma/channels/requirements.ts`), and note the
  gate in the IH `rules` (`prisma/channels/core.ts`). No fabricated number.
- **Phase 1:** plan segmentation ("post now / warm up / no access") driven by the
  existing readiness block + a `gate` field on `accountRequirements`. Deferred
  from an immediate blind edit because it depends on the model below and the plan
  page needs real browser verification (auth + a launch-mode ship).
- **Phase 2:** `ChannelAccess` self-report model + inline capture control.
- **Phase 3:** feed `access` into ranking/segmentation everywhere; owned-channel
  reach buckets influence "post now" ordering.

## Open questions

- Scope: user/account-level (v1) vs. per-project override for teams.
- Taxonomy: platform-level `standing` vs. a few channel-specific keys — how
  granular before it's friction?
- Do we reconcile self-reported standing against anything (e.g., a founder linked
  their GitHub/X) or keep it purely declared?
- How does `blocked` interact with the Free-plan channel cap and launch mode?
