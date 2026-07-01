# PRD — LaunchWake

## 1. Problem

Technical founders ship great products into silence. Marketing feels like a foreign
language. The three concrete pains:

- **"Where do I even post this?"** — they don't know which communities fit, or the rules.
- **"I don't have time."** — every launch post is an hour not building; marketing slips.
- **"Did any of it work?"** — no attribution, so they can't repeat what worked.

Evidence: GummySearch (140k users) shut down Nov 2025 over Reddit API economics; Reddit's
2025 crackdown removed ~70% of auto-posting accounts and forced several auto-reply tools
to pause. The space is full of "monitor + reply" tools; the unsolved, defensible job is
**where + rules + ban-safety + ROI**, not draft generation.

## 2. Target user

Primary: solo / small-team technical founders (indie hackers, dev-tool builders) shipping
a product, no marketing team, no audience. They live on GitHub, HN, X, dev communities.

Secondary (later): small B2B SaaS marketing teams; agencies (multi-project).

## 3. Value proposition

> For every ship, LaunchWake tells you exactly where to post it, how to do it without
> getting banned, and shows you what actually drove signups.

## 4. Positioning & non-goals

- **Every-ship distribution engine**, not a one-time launch tool (retention comes from
  continuous use — each release/feature/blog is a distribution moment).
- **Intelligence-led**, not a scheduler. Hero = plan + attribution.

**Non-goals (explicitly out of scope):**
- Auto-posting / bot accounts / managed account pools.
- Being a generic social media scheduler (Buffer/Hypefury clone).
- Brand-monitoring / social listening (Brandwatch territory).
- DM automation, follower growth hacks.

## 5. Core loop

Ship (detected from GitHub or added manually) → Analysis → Distribution plan
(ranked channels) → Launch kit (drafts) → user posts → tracked links → Results
(attribution) → outcome data sharpens future recommendations.

## 6. Features

### MVP (v0.1) — must have
- GitHub OAuth login; connect a repo + product URL (Project).
- Add/detect a Ship (manual paste or from a commit/release).
- **Distribution plan**: rank a seeded catalog of channels by fit for this ship/product;
  each recommendation has fit score (0–100), ban risk (Low/Med/High), best time, rule note,
  and a one-line "why". (Hero feature.)
- **Launch kit**: platform-native drafts (HN, X, Reddit, LinkedIn, Product Hunt) per channel,
  copy button, safety note. Grounded in each channel's rules.
- **Tracked links + Results**: generate UTM/short links per post; ingest clicks & signups;
  per-channel conversion table + one insight line.
- Onboarding that ends in the **first plan** (activation). Empty states + getting-started checklist.
- Free plan limits (1 project, 2 plans/month); Stripe upgrade to Pro ($29/mo).

### v0.2 — should have
- Auto-detect ships via GitHub webhook (releases/commits) → Ship feed.
- **Channels** library view (catalog + your history + ban risk).
- Outcome-based re-ranking (the flywheel): channels that converted for similar products rank higher.
- Scheduling reminders (not posting — just "post this Tue 8am ET").

### Later
- More platforms & niche community catalog expansion; team/agency multi-project;
  Slack notifications on new ship; content-calendar view.

## 7. Success metrics

- **Activation:** % of new users who generate ≥1 distribution plan for their own product (target > 60%).
- **Aha→value:** % who mark ≥1 post as published and get ≥1 attributed signup.
- **Retention (the real test):** % returning to distribute a *second* ship within 30 days.
- Free→Pro conversion.

## 8. Key risks & mitigations

- *Draft generation is commoditized* → make plan + attribution the hero; drafts secondary.
- *Launches are infrequent* → every-ship positioning + auto-detection to create weekly use.
- *Recommending fake communities gets users banned* → constrain LLM to a curated catalog.
- *Single-platform API fragility (the GummySearch lesson)* → be multi-channel; never depend on one API for survival; where scraping is needed, keep it non-core and replaceable.
