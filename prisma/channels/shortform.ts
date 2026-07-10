import { Platform, BanRisk } from "@prisma/client";
import type { Seed } from "./types";

/**
 * Short-form video channels — TikTok, Instagram Reels, YouTube Shorts.
 *
 * These are FORMATS, not moderated communities, so two things are different from
 * every other pack:
 *
 *   1. `rules` is FORMAT intelligence, not community norms. The thing that gets
 *      you nowhere here isn't a mod queue — it's a weak hook, a link nobody can
 *      click, and inconsistent posting. So the rules teach the format: hook in the
 *      first 2 seconds, screen-record the demo, ride a trending sound, post on a
 *      cadence, and — honestly — expect weak tracked attribution because these
 *      platforms allow NO clickable links in posts (bio link only).
 *
 *   2. Fit is strictly gated. Every entry carries ONLY visual/consumer fit-tags
 *      (`consumer`, `mobile-app`, `visual-demo`, `design`, `game`, `b2c`) plus the
 *      `shortform` marker — and NONE of the generic developer/B2B tags. Combined
 *      with the `shortformEligible` gate in `lib/channels.ts`, that means these
 *      never surface for a CLI, an API, or a B2B SaaS: they only appear when the
 *      product itself is visual and consumer-facing (a phone app, a game, a design
 *      tool). `defaultBanRisk` is LOW because the constraint is platform ToS and
 *      the algorithm, not a moderator removing your post.
 */
export const shortform: Seed[] = [
  {
    slug: "tiktok-build-in-public",
    name: "TikTok — Build in Public",
    platform: Platform.TIKTOK,
    url: "https://www.tiktok.com/tag/buildinpublic",
    audienceDesc:
      "Hundreds of millions of mostly-mobile consumers, with a fast-growing #buildinpublic and indie-founder creator scene that rewards authentic 'making of' journeys and honest app reveals over polished ads.",
    rules:
      "This is a FORMAT, not a moderated community — the constraint is TikTok's ToS and the algorithm, not a mod queue. Hook in the first 2 seconds (open on the payoff or the problem, never a slow logo intro) or you're scrolled past. Screen-record the product in action and narrate the real build story; ride a trending-but-relevant sound to earn the first push, and post on a consistent cadence (3–5×/week) since reach is per-video, not per-follower. Attribution caveat: TikTok allows NO clickable links in captions — only your profile bio link — so tracked attribution here is weak. Point the bio at ONE dedicated bio short link and expect most signups to arrive as direct or self-reported, not tracked.",
    defaultBanRisk: BanRisk.LOW,
    bestTime: "Tue–Thu, 6–9pm (viewer's local time)",
    tags: ["shortform", "consumer", "b2c", "visual-demo"],
  },
  {
    slug: "tiktok-app-demo",
    name: "TikTok — App Demo",
    platform: Platform.TIKTOK,
    url: "https://www.tiktok.com/tag/appsyoushouldhave",
    audienceDesc:
      "Consumer app discovery on TikTok: viewers actively surface 'apps you should have' and satisfying product demos, then search the App Store by name — strong for a phone app with a visual, in-hand moment.",
    rules:
      "Format intelligence, not mod rules. Lead with the single most satisfying 2-second moment of the app doing its thing (the transformation, the result), then show it end-to-end as a clean screen recording with big on-screen captions. A trending sound gets the initial distribution; native, phone-shot footage outperforms exported marketing renders. Post 3–5×/week and reply to comments with the exact app name (people search it). Attribution caveat: no tappable links in-post — only the bio link — so expect weak tracked attribution; use one dedicated bio short link and lean on App Store search + self-reported 'where did you hear about us' to close the loop.",
    defaultBanRisk: BanRisk.LOW,
    bestTime: "Daily, 7–10pm (viewer's local time)",
    tags: ["shortform", "mobile-app", "consumer", "visual-demo"],
  },
  {
    slug: "tiktok-gameplay",
    name: "TikTok — Gameplay Clips",
    platform: Platform.TIKTOK,
    url: "https://www.tiktok.com/tag/indiegame",
    audienceDesc:
      "Huge #indiegame and gaming audience that shares and stitches satisfying gameplay clips; a strong wishlist/download driver for a visually distinctive game.",
    rules:
      "A format, not a community feed. The hook is the first 2 seconds of gameplay — the most visually striking mechanic, kill, or 'oddly satisfying' moment — with no intro card. Screen-capture at 60fps, keep it vertical, add captions for the mute-scrollers, and use a trending sound where it fits the vibe. Post clips on a steady cadence (several a week); one breakout clip can carry a whole launch. Attribution caveat: TikTok posts carry NO clickable link — bio link only — so tracked attribution is weak; route the bio to a single dedicated short link (Steam page / store) and expect much of the lift to show as direct traffic and wishlist spikes you can only self-attribute.",
    defaultBanRisk: BanRisk.LOW,
    bestTime: "Fri–Sun, 5–9pm (viewer's local time)",
    tags: ["shortform", "game", "consumer", "visual-demo"],
  },
  {
    slug: "instagram-reels",
    name: "Instagram Reels",
    platform: Platform.INSTAGRAM,
    url: "https://www.instagram.com/reels/",
    audienceDesc:
      "Broad consumer and prosumer audience skewing design-, lifestyle-, and brand-conscious; Reels is Instagram's primary reach surface and rewards a strong visual aesthetic.",
    rules:
      "Treat this as a format: the first 2 seconds decide whether the Reel is served beyond your followers, so open on the result, not a title slide. Screen-record or film the product in action, cut tight, add captions, and use a trending audio that fits — Instagram suppresses reach on videos with a visible TikTok watermark, so export clean and re-shoot rather than cross-post the watermarked file. Post 3–4 Reels/week and put a short CTA in the caption. Attribution caveat: captions can't hold a tappable link — only the profile bio link (or a link sticker in Stories) — so tracked attribution from Reels is weak; use one dedicated bio short link and reconcile the rest via self-reported signups.",
    defaultBanRisk: BanRisk.LOW,
    bestTime: "Mon/Wed/Fri, 11am–1pm & 7–9pm",
    tags: ["shortform", "consumer", "b2c", "visual-demo"],
  },
  {
    slug: "instagram-reels-design",
    name: "Instagram Reels — Design & Before/After",
    platform: Platform.INSTAGRAM,
    url: "https://www.instagram.com/explore/tags/uidesign/",
    audienceDesc:
      "Large design, UI/UX, and creative-tool audience on Instagram that engages heavily with before/after transformations, timelapses, and screen-recorded craft.",
    rules:
      "Format-first intelligence for visual/design products. Hook in 2 seconds with the 'after' or the most dramatic frame of the transformation, then show the before→after or the build timelapse as a crisp screen recording. Captions on, trending-but-tasteful audio, and export without a TikTok watermark (it throttles reach). A consistent 3×/week cadence compounds; save-worthy craft outperforms a hard sell. Attribution caveat: no clickable link in the caption — bio link only — so tracked attribution is weak; send the bio to a single dedicated short link and expect design-driven signups to lean on self-reported attribution.",
    defaultBanRisk: BanRisk.LOW,
    bestTime: "Tue–Thu, 12–2pm & 8–10pm",
    tags: ["shortform", "design", "visual-demo", "consumer"],
  },
  {
    slug: "youtube-shorts",
    name: "YouTube Shorts",
    platform: Platform.YOUTUBE,
    url: "https://www.youtube.com/shorts",
    audienceDesc:
      "Massive consumer audience with strong intent and search discovery; Shorts can funnel viewers to a full channel, and unlike the other two, YouTube descriptions DO allow a real clickable link.",
    rules:
      "A format on top of YouTube's engine. Hook in the first 2 seconds — state the outcome or the problem immediately — and keep the Short under ~30s of tight, screen-recorded demo with on-screen captions; trending or original audio both work, but retention (did they watch to the end / loop) is what drives reach. Post consistently and let strong Shorts pull viewers to longer videos. Attribution advantage vs TikTok/Reels: the description and pinned comment CAN hold a clickable link, so a tracked short link here actually converts — still add a dedicated bio/handle link, but expect stronger tracked attribution than the other short-form platforms.",
    defaultBanRisk: BanRisk.LOW,
    bestTime: "Daily, 12–3pm & 7–10pm",
    tags: ["shortform", "consumer", "visual-demo", "mobile-app"],
  },
  {
    slug: "youtube-shorts-gaming",
    name: "YouTube Shorts — Gaming",
    platform: Platform.YOUTUBE,
    url: "https://www.youtube.com/gaming",
    audienceDesc:
      "One of the largest gaming audiences anywhere; Shorts clips of standout gameplay drive channel subs and store-page traffic, with a clickable link available in the description.",
    rules:
      "Format guidance for a visually distinctive game. Open on the best 2 seconds of gameplay — the clutch moment, the satisfying loop, the wow mechanic — no intro. Vertical 60fps capture, captions for context, and a hook line on screen; retention and loops drive the algorithm more than the audio choice. Post clips steadily around beats (trailer, update, launch). Attribution note: unlike TikTok/Reels, the Short's description and pinned comment allow a real clickable link, so a tracked link to the Steam/store page converts here — still keep a dedicated short link, but you'll get meaningfully more tracked attribution than on the other platforms.",
    defaultBanRisk: BanRisk.LOW,
    bestTime: "Fri–Sun, 4–9pm (viewer's local time)",
    tags: ["shortform", "game", "consumer", "visual-demo"],
  },
];
