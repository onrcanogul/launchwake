import type { AccountRequirementsInput } from "../../lib/accountReadiness";

/**
 * Reusable account-requirement presets for the catalog.
 *
 * Every value here is grounded in a real, publicly-stated norm and marked
 * "recommended" unless the channel enforces a formal, published gate. We never
 * invent hard thresholds: where a community has no numeric rule, these encode
 * the widely-documented "don't post from a zero-history account" guidance and
 * say so in `sourceNote`. Keep this honest — a wrong number gets a founder banned.
 */

/**
 * General Reddit self-promotion readiness. Most programming/startup subreddits
 * run AutoModerator filters that remove posts from very new or low-karma
 * accounts; the exact numbers are per-sub and usually unpublished, so these are
 * conservative *recommended* baselines, not a specific subreddit's rule.
 */
export function redditReadiness(
  overrides?: Partial<{
    minAccountAgeDays: number;
    minKarma: number;
    extraTips: string[];
  }>,
): AccountRequirementsInput {
  return {
    level: "recommended",
    minAccountAgeDays: overrides?.minAccountAgeDays ?? 30,
    minKarmaOrReputation: { value: overrides?.minKarma ?? 100, unit: "combined karma" },
    profileTips: [
      "Post from a real, established account — not one made for this launch.",
      "Comment genuinely in the subreddit for 1–2 weeks before you post.",
      "Read the sidebar/wiki rules; many subs funnel promo into a weekly thread.",
      ...(overrides?.extraTips ?? []),
    ],
    sourceNote:
      "General Reddit self-promotion norms — many programming/startup subreddits' AutoModerator removes posts from new or low-karma accounts; exact thresholds vary by subreddit, so check its rules.",
  };
}

/** Hacker News — no karma gate to submit, but green (new) usernames get scrutiny. */
export const HN_SHOW_READINESS: AccountRequirementsInput = {
  level: "recommended",
  minAccountAgeDays: 14,
  profileTips: [
    "Add a real name and an 'about' that says what you're building.",
    "Comment on other threads for a week or two so you're not a zero-history 'green' account.",
    "Line up honest early testers — never organize upvotes; vote rings get flagged.",
  ],
  sourceNote:
    "Hacker News guidelines & FAQ — there's no karma requirement to submit, but new ('green') accounts draw more scrutiny and voting rings are penalized.",
};

/** HN link submissions — same spirit as Show HN, lighter (no artifact to defend). */
export const HN_READINESS: AccountRequirementsInput = {
  level: "recommended",
  minAccountAgeDays: 14,
  profileTips: [
    "Submit from an account with some genuine comment history, not a fresh one.",
    "Add an 'about' with your real identity — it reads as less spammy.",
  ],
  sourceNote:
    "Hacker News FAQ — no karma gate to submit links, but brand-new accounts and self-promotion patterns attract flags.",
};

/** Product Hunt — complete maker profile + a little follower warm-up before launch day. */
export const PRODUCT_HUNT_READINESS: AccountRequirementsInput = {
  level: "recommended",
  minAccountAgeDays: 14,
  minKarmaOrReputation: { value: 30, unit: "followers" },
  profileTips: [
    "Complete your maker profile: avatar, bio, links, and any past projects.",
    "Follow and engage on Product Hunt for a couple of weeks so you have some followers before launch day.",
    "Prepare your gallery assets and first comment (the maker story) in advance.",
    "Never buy or solicit upvotes — it's grounds for removal.",
  ],
  sourceNote:
    "Product Hunt maker guidance — no follower gate to launch, but a complete profile and an existing following materially improve launch-day reach; vote manipulation is bannable.",
};

/**
 * Indie Hackers — HARD gate on post creation. A fresh account literally can't
 * post ("You can't create posts yet"); privileges are earned via authentic
 * comments (moderator-granted) or bought via IH Plus. Non-numeric gate, so the
 * readiness engine won't compute a lead-time penalty — the "required" level +
 * tips carry it. (Observed while dogfooding LaunchWake's own launch.)
 */
export const INDIE_HACKERS_READINESS: AccountRequirementsInput = {
  level: "required",
  profileTips: [
    "You can't post until IH grants post-creation privileges — a fresh account hits a 'You can't create posts yet' wall.",
    "Earn it first: leave genuinely thoughtful, effortful comments over ~1–2 weeks; moderators grant lifelong posting access to accounts that contribute authentically.",
    "Fill out your profile with your real name, product, and a link so you read as a real member.",
    "The paid shortcut is Indie Hackers Plus, which unlocks posting immediately — otherwise hold your launch draft until access is granted.",
  ],
  sourceNote:
    "Observed 2026-07-08 on /new-post: IH gates post creation ('You can't create posts yet' — participate with effortful comments; moderators grant lifelong access, or unlock via Indie Hackers Plus). No fixed age/karma number — earned via authentic participation or IH Plus.",
};

// ── Verified July 2026 (web research against each channel's own pages) ──────

/** Lobsters — the only hard-gated aggregator here: invite-only + new-user window. */
export const LOBSTERS_READINESS: AccountRequirementsInput = {
  level: "required",
  minAccountAgeDays: 70,
  profileTips: [
    "Get invited well before launch — ask someone you know on the site or hang out in the chat room to get known.",
    "New accounts can't use the show/announce tags for their first ~70 days.",
    "Keep self-promo under a quarter of your combined stories + comments (the documented rule of thumb).",
    "Frame your post as technical content, not a product announcement — 'write-only' promoters are the stated target of the rule.",
  ],
  sourceNote:
    "lobste.rs/about — invite-only; users are 'new' for their first 70 days and can't post show/announce-tagged stories; self-promo 'should be less than a quarter of one's stories and comments'.",
};

/** WIP — membership-gated maker community (invite; a paid signup path exists). */
export const WIP_READINESS: AccountRequirementsInput = {
  level: "required",
  profileTips: [
    "Ask an existing WIP member for an invite — that's the documented path in.",
    "The community is a shipping log: post todos and progress before promoting anything.",
    "Pricing isn't published on the public pages — confirm it at checkout if you join via the paid path.",
  ],
  sourceNote:
    "wip.co — 'Members are invited by existing members'; a paid signup path exists via Stripe checkout with the price shown only in-flow.",
};

/** BetaList — no account gate, but a strict editorial queue with stage criteria. */
export const BETALIST_READINESS: AccountRequirementsInput = {
  level: "recommended",
  profileTips: [
    "Submit pre-launch or right after launch — 'launched weeks ago or longer' is a documented disqualifier.",
    "Use a distinct, custom-designed landing page on your own domain with a working signup — templates and free-host subdomains are rejected.",
    "Plan for the queue: review can take a few weeks and featuring ~2 months; the paid expedite is refunded if rejected.",
    "You get two features (pre-launch and launch) — space them a few weeks apart.",
  ],
  sourceNote:
    "BetaList FAQ + submission criteria (betalist.com/criteria) — editorial selection; product must be relatively new with a distinct landing page visitors can sign up on.",
};

/** X — no gate; the documented risks are spam-flagged replies and coordinated pushes. */
export const X_READINESS: AccountRequirementsInput = {
  level: "recommended",
  profileTips: [
    "Launch from your established profile, not a fresh brand account with no history.",
    "Don't drop your link in replies to unrelated posts — that's the documented spam signal.",
    "Never coordinate amplification across accounts; the platform-manipulation policy covers exactly that.",
  ],
  sourceNote:
    "X Rules & Premium help pages — no formal gate to post; unrelated link-drop replies and coordinated amplification fall under the platform-manipulation and spam policy.",
};

/** LinkedIn — no gate; authenticity and no-engagement-pods are the written rules. */
export const LINKEDIN_READINESS: AccountRequirementsInput = {
  level: "recommended",
  profileTips: [
    "Post from your real, complete profile — the policies require your true identity.",
    "Tell the launch as a professional story; untargeted promotional blasts are the named violation.",
    "Skip engagement pods and like-trades — agreeing to boost each other's content is explicitly prohibited.",
    "Disclose any compensated amplification 'clearly and conspicuously'.",
  ],
  sourceNote:
    "LinkedIn Professional Community Policies — authentic identity required; engagement pods, untargeted promotional messaging, and undisclosed paid endorsements are explicitly prohibited.",
};

/** dev.to — open publishing; #showdev is the sanctioned launch lane. */
export const DEVTO_READINESS: AccountRequirementsInput = {
  level: "recommended",
  profileTips: [
    "Publish a substantive post or two first so the account isn't 'designed primarily for promotion' (Terms wording).",
    "Put the full story in the post body — link-only posts violate the Terms.",
    "Launch under #showdev and keep it community-driven, not salesy (the tag's own guideline).",
    "Disclose affiliate or compensated links.",
  ],
  sourceNote:
    "dev.to Terms of Use + #showdev tag guidelines — no formal gate; content must not be primarily promotional and #showdev is explicitly 'for showing off projects and launching products'.",
};

/** Hashnode — open publishing on your own blog; anti-'primarily self-promo' CoC. */
export const HASHNODE_READINESS: AccountRequirementsInput = {
  level: "recommended",
  profileTips: [
    "Set up your own Hashnode blog — you own the space; the feed is secondary.",
    "Mix launch notes with genuine technical posts; the Code of Conduct bans using the platform 'primarily for self-promotion'.",
    "No misleading link text — it's treated as SEO abuse.",
  ],
  sourceNote:
    "Hashnode Code of Conduct — no formal gate; bulk posting, engagement farming, and using the platform primarily for self-promotion are prohibited.",
};

/** Medium — publishes anything first-party, but promo posts lose distribution. */
export const MEDIUM_READINESS: AccountRequirementsInput = {
  level: "recommended",
  profileTips: [
    "Frame the post as a firsthand build story — stories whose primary point is selling or gathering signups are excluded from General Distribution.",
    "Keep the product CTA secondary to reader value; 'a sales pitch' is the documented Boost disqualifier.",
    "Disclose affiliate links; don't cross-post identical copies.",
  ],
  sourceNote:
    "Medium Rules + Distribution/Boost guidelines — first-party promotion is allowed, but stories primarily driving traffic or sales are ineligible for General Distribution and Boost.",
};

/** Substack — your own list; the platform bans promo-first publications. */
export const SUBSTACK_READINESS: AccountRequirementsInput = {
  level: "recommended",
  profileTips: [
    "Position the publication as an editorial build-log, not a promo channel — publications whose main goal is advertising are prohibited.",
    "Only import subscribers who explicitly opted into this publication; Substack is 'vehemently anti-spam'.",
    "Publishing as a brand (not a person) may trigger additional verification.",
  ],
  sourceNote:
    "Substack Content Guidelines — intended for editorial content; publications mainly advertising products, driving traffic, or doing SEO are prohibited.",
};

/** HackerNoon — every story passes human editorial review, with hard link caps. */
export const HACKERNOON_READINESS: AccountRequirementsInput = {
  level: "required",
  profileTips: [
    "Plan for the 3–5 business-day editorial review in your launch timing.",
    "Cap product links at one per 500 words and cite outside sources so it doesn't read as an ad.",
    "Write first-person under a real profile — 'real stories written by real tech professionals'.",
    "Never add promo links after publication — that's a documented permanent ban.",
  ],
  sourceNote:
    "HackerNoon help docs — every submission is human-reviewed (median 3–5 business days); backlink rule is 1 promo link per 500 words, and post-publication promo edits are a permanent ban.",
};

/** freeCodeCamp News — author application with writing samples; full editorial flow. */
export const FCC_NEWS_READINESS: AccountRequirementsInput = {
  level: "required",
  minKarmaOrReputation: { value: 3, unit: "published writing samples" },
  profileTips: [
    "Apply via the Publication Style Guide with links to 3 articles you've already written — only a small percentage are approved.",
    "Once accepted you publish through their Hashnode publication; every article needs both the Hashnode submission AND an email to editorial.",
    "Pitch tutorials that teach the problem space — this is an educational publication, not a launch board.",
  ],
  sourceNote:
    "freeCodeCamp News style + publication guides — authors are approved by application with 3 writing samples and every article is editorially reviewed.",
};

/** DZone — real-name profile required and every article moderated; promo rejected. */
export const DZONE_READINESS: AccountRequirementsInput = {
  level: "required",
  profileTips: [
    "Complete your profile with real name, valid email, and job title — a documented submission requirement.",
    "Write a vendor-neutral technical piece of 800+ words; 'content with the goal of advertising your product' is a documented rejection.",
    "Strip UTM parameters and links to paid tools from the draft.",
    "Expect 7–12+ business days of moderation before it runs.",
  ],
  sourceNote:
    "DZone contributor + article submission guidelines — real-name profile with job title required, 800-word minimum, every article moderated, and promotional intent is an explicit rejection reason.",
};

/** AlternativeTo — the one directory with a published account-age gate. */
export const ALTERNATIVETO_READINESS: AccountRequirementsInput = {
  level: "required",
  minAccountAgeDays: 7,
  profileTips: [
    "Create your account at least a week before launch — new users must wait 7 days to submit an app.",
    "Submit a clean official URL: UTM parameters are explicitly disallowed, so don't use a tracked link here.",
    "After approval, claim the listing from your product-domain email to get edit rights.",
    "Add your app as an alternative to the incumbents your users compare you against — that's the discovery mechanism.",
  ],
  sourceNote:
    "AlternativeTo FAQ — new accounts must wait one week before submitting an app; submissions are moderated within days–a week and the official link must be UTM-free.",
};

/** SaaSHub — approval queue; live products only, competitors listed. */
export const SAASHUB_READINESS: AccountRequirementsInput = {
  level: "recommended",
  profileTips: [
    "Submit only after the product is live — waitlist landing pages and unreleased products are rejected.",
    "List relevant competitors at submission; missing alternatives is the documented queue-slowdown.",
    "Verify with an email on the product's domain for priority + edit rights, and re-verify quarterly for the homepage slot.",
  ],
  sourceNote:
    "SaaSHub submit page + FAQ — all products pass an approval queue; unreleased/waitlist products and free-subdomain sites are rejected; domain-email verification grants priority.",
};

/** r/cybersecurity — the one researched subreddit with published numeric limits. */
export const R_CYBERSECURITY_READINESS: AccountRequirementsInput = {
  level: "required",
  profileTips: [
    "Keep promotion under 10% of your posts + comments in this subreddit — roughly nine genuine contributions per promo post.",
    "Promote a given product at most once per week; enforcement is automated.",
    "A zero-history account posting an offsite link is removed — contribute before you share anything of yours.",
    "Ad-bearing blog posts need the 'Corporate Blog' flair; AI-generated content is forbidden sub-wide, and soliciting DMs can mean a ban.",
  ],
  sourceNote:
    "r/cybersecurity rules + promotion wiki — promotion must stay under 10% of your activity in the sub and at most once a week per promoted entity; zero-history offsite links are not allowed.",
};
