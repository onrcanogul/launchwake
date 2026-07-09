import { randomBytes, createHash, createHmac, timingSafeEqual } from "crypto";
import { db } from "./db";
import { env } from "./env";
import { isSafeHttpUrl } from "./url";
import { captureError } from "./observability";
import type { CoachResult } from "./coach";
import type { Platform } from "@prisma/client";
import {
  normalizeSource,
  rollupSelfReports,
  buildSelfReportInsight,
  MAX_ANSWER_LEN,
  type SelfReportRow,
  type SelfReportRollup,
} from "./selfReport";

/**
 * Attribution: tracked links + click/signup ingest + per-channel rollups.
 *
 * Flow: user marks a channel as "posted" → we mint a TrackedLink (/r/{code}) →
 * they put that link in their post → clicks hit /r/{code} (CLICK event, redirect
 * to the product with UTM + lw_ref) → the product's thank-you page pings
 * /api/track/signup with lw_ref (SIGNUP event). Results reads the rollup.
 */

// ── Pure helpers (unit-testable) ───────────────────────────

const ALPHABET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/** URL-safe short code, base62. */
export function generateShortCode(len = 7): string {
  const bytes = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

/**
 * Validate a raw `lw_ref` cookie value before we trust or store it. A ref is a
 * tracked-link short code (base62), so anything else — empty, over-long, or
 * carrying punctuation — is treated as absent rather than persisted. Returns the
 * clean ref, or null if it isn't one.
 */
export function sanitizeRef(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const ref = raw.trim();
  return /^[0-9A-Za-z]{1,64}$/.test(ref) ? ref : null;
}

export function platformSource(platform: Platform | string): string {
  return String(platform).toLowerCase();
}

// ── Idempotency keys (dedup) ───────────────────────────────
// CLICK and SIGNUP ingestion is idempotent: each event carries a `dedupeKey` and
// a partial unique index (trackedLinkId, type, dedupeKey) makes a re-fire a
// no-op. The keys below are pure + deterministic so the same visitor/day always
// hashes to the same key (and so they're unit-testable without a request).

function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/** UTC calendar day (YYYY-MM-DD) — the fixed dedup window for click/signup keys. */
export function utcDayStamp(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export type ClickDedupeInput = {
  /** Best-effort client IP (hashed into the key — never stored raw). */
  ip: string;
  userAgent: string;
  shortCode: string;
  /** UTC day; defaults to today. Passed in tests for determinism. */
  day?: string;
};

/**
 * Dedup key for a CLICK: sha256(ipHash + userAgent + shortCode + UTC-day). Same
 * IP + UA hitting the same link within a UTC day collapses to one CLICK, so a
 * double-tap, a ret/refresh, or a redirect replay can't inflate the count.
 */
export function clickDedupeKey(input: ClickDedupeInput): string {
  const day = input.day ?? utcDayStamp();
  const ipHash = sha256Hex(input.ip || "");
  return sha256Hex(`${ipHash}|${input.userAgent}|${input.shortCode}|${day}`);
}

export type SignupDedupeInput = ClickDedupeInput & {
  /** Email from the pixel/beacon, if it supplies one. */
  email?: string | null;
};

/**
 * Dedup key for a SIGNUP. Prefer sha256(lowercased email) when the pixel/beacon
 * reports one — the strongest identity, so the same person signing up twice via
 * one link counts once regardless of device/day. Falls back to the same ip-based
 * key as a click when there's no email.
 */
export function signupDedupeKey(input: SignupDedupeInput): string {
  const email = input.email?.trim().toLowerCase();
  if (email) return sha256Hex(`email:${email}`);
  return clickDedupeKey(input);
}

// ── Revenue signature (HMAC) ───────────────────────────────

/**
 * Constant-time verify of an `x-lw-signature` header against the raw request
 * body, using the project's `webhookSecret` as the HMAC-SHA256 key. Accepts a
 * bare hex digest or a `sha256=<hex>` prefixed one. Pure → unit-testable.
 */
export function verifyRevenueSignature(
  rawBody: string,
  signature: string | null | undefined,
  secret: string | null | undefined,
): boolean {
  if (!secret || !signature) return false;
  const provided = signature.startsWith("sha256=") ? signature.slice(7) : signature;
  if (!/^[0-9a-fA-F]{64}$/.test(provided)) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(provided.toLowerCase(), "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function slugifyCampaign(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/** Append UTM params + lw_ref to the product URL for a given channel/ship. */
export function buildDestUrl(
  productUrl: string,
  platform: Platform | string,
  shipTitle: string,
): string {
  const u = new URL(productUrl);
  u.searchParams.set("utm_source", platformSource(platform));
  u.searchParams.set("utm_medium", "launchwake");
  u.searchParams.set("utm_campaign", slugifyCampaign(shipTitle));
  const dest = u.toString();
  // A tracked link may only ever point at a real http(s) product URL — never a
  // javascript:/data:/etc. scheme (would make the redirector an XSS vector).
  if (!isSafeHttpUrl(dest)) {
    throw new Error(`Refusing to build tracked link for unsafe URL: ${productUrl}`);
  }
  return dest;
}

/** The public tracked link a user pastes into their post. */
export function trackedUrl(shortCode: string): string {
  return `${env.APP_URL.replace(/\/$/, "")}/r/${shortCode}`;
}

// ── Write side ─────────────────────────────────────────────

export type RecordedPost = {
  postId: string;
  shortCode: string;
  trackedUrl: string;
  destUrl: string;
};

/**
 * Mark a recommendation's channel as posted: create the Post + a TrackedLink
 * pointing at the product URL with UTM. Idempotent per (ship, channel) — returns
 * the existing tracked link if already recorded.
 */
export async function recordPostForRecommendation(
  recommendationId: string,
  postedUrl?: string,
): Promise<RecordedPost> {
  const rec = await db.recommendation.findUnique({
    where: { id: recommendationId },
    include: {
      channel: true,
      plan: { include: { ship: { include: { project: true } } } },
    },
  });
  if (!rec) throw new Error("Recommendation not found");

  const ship = rec.plan.ship;
  const project = ship.project;
  if (!project.url) {
    throw new Error(
      "Add a product URL in Settings before tracking — that's where clicks are sent.",
    );
  }

  const existing = await db.post.findFirst({
    where: { shipId: ship.id, channelId: rec.channelId },
    include: { trackedLink: true },
  });
  if (existing?.trackedLink) {
    return {
      postId: existing.id,
      shortCode: existing.trackedLink.shortCode,
      trackedUrl: trackedUrl(existing.trackedLink.shortCode),
      destUrl: existing.trackedLink.destUrl,
    };
  }

  const destUrl = buildDestUrl(project.url, rec.channel.platform, ship.title);

  // Create the post (reuse an existing post for this channel if present).
  const post =
    existing ??
    (await db.post.create({
      data: {
        shipId: ship.id,
        channelId: rec.channelId,
        url: postedUrl || null,
      },
    }));

  // Mint a unique short code (retry on the rare collision).
  let shortCode = generateShortCode();
  for (let i = 0; i < 5; i++) {
    const clash = await db.trackedLink.findUnique({ where: { shortCode } });
    if (!clash) break;
    shortCode = generateShortCode();
  }

  await db.trackedLink.create({
    data: { postId: post.id, shortCode, destUrl },
  });

  // Advance ship status to POSTED.
  await db.ship.update({ where: { id: ship.id }, data: { status: "POSTED" } });

  return { postId: post.id, shortCode, trackedUrl: trackedUrl(shortCode), destUrl };
}

/** Log a CLICK and return the destination (with lw_ref appended). */
export async function ingestClick(
  shortCode: string,
  opts: { record?: boolean; dedupeKey?: string | null } = {},
): Promise<string | null> {
  const link = await db.trackedLink.findUnique({ where: { shortCode } });
  if (!link) return null;
  // Read-time open-redirect guard: never 302 to a non-http(s) destination even
  // if a bad value somehow reached the row. Caller falls back to the home page.
  if (!isSafeHttpUrl(link.destUrl)) return null;
  // `record: false` (rate-limited / bot hits) still redirects the human but does
  // not log a CLICK — so a script can't inflate a channel's click count.
  if (opts.record !== false) {
    try {
      // Single-query idempotent insert: createMany + skipDuplicates emits
      // INSERT … ON CONFLICT DO NOTHING, so a re-fire on the same dedupeKey is a
      // silent no-op (honors the partial unique index) and never adds a query to
      // the redirect path.
      await db.event.createMany({
        data: [{ trackedLinkId: link.id, type: "CLICK", dedupeKey: opts.dedupeKey ?? null }],
        skipDuplicates: true,
      });
    } catch (err) {
      // Logging the click must never break the redirect — capture and continue.
      captureError(err, { at: "attribution.ingestClick", trackedLinkId: link.id });
    }
  }
  const u = new URL(link.destUrl);
  u.searchParams.set("lw_ref", shortCode);
  return u.toString();
}

export type IngestSignupOptions = {
  /** Idempotency key (see signupDedupeKey). A re-fire on the same key is a no-op. */
  dedupeKey?: string | null;
  /**
   * When set, enforce that the tracked link belongs to this project — for callers
   * that carry a *verified* project context (authenticated server actions). A
   * mismatch is refused with a captured warning. Public pixel calls omit this and
   * stay global (they only carry the short code).
   */
  projectId?: string;
};

/**
 * Log a SIGNUP for a tracked link. Idempotent: with a `dedupeKey`, a repeat fire
 * (retried beacon, double submit) is silently skipped. Returns true only when a
 * NEW event was recorded — so the caller's first-signup / pixel-installed logic
 * never re-fires on a dedup. Returns false on an unknown code, a tenant mismatch,
 * a dedup, or a write error.
 */
export async function ingestSignup(
  shortCode: string,
  meta?: Record<string, unknown>,
  opts?: IngestSignupOptions,
): Promise<boolean> {
  const link = await db.trackedLink.findUnique({
    where: { shortCode },
    select: { id: true, post: { select: { ship: { select: { projectId: true } } } } },
  });
  if (!link) return false;
  if (opts?.projectId && link.post.ship.projectId !== opts.projectId) {
    // A verified caller asked to attribute to a link it doesn't own — refuse and
    // surface it (a cross-tenant write would silently corrupt another founder's data).
    captureError(new Error("SIGNUP tenant mismatch: link does not belong to project"), {
      at: "attribution.ingestSignup.tenantMismatch",
      projectId: opts.projectId,
    });
    return false;
  }
  try {
    const res = await db.event.createMany({
      data: [
        {
          trackedLinkId: link.id,
          type: "SIGNUP",
          dedupeKey: opts?.dedupeKey ?? null,
          meta: meta ? (meta as object) : undefined,
        },
      ],
      skipDuplicates: true,
    });
    return res.count > 0;
  } catch (err) {
    // The signup beacon is fire-and-forget; surface the failure instead of
    // 500-ing a sendBeacon the browser won't retry.
    captureError(err, { at: "attribution.ingestSignup", trackedLinkId: link.id });
    return false;
  }
}

/**
 * Persist the channel ref captured at signup onto the user, so a later payment
 * can be attributed to the channel that drove them here — LaunchWake dogfooding
 * its own revenue attribution (see `attributeInvoiceRevenue` in lib/billing).
 * No-op when the ref is missing or malformed. Best-effort: a write failure is
 * logged, never surfaced to the sign-in flow. Returns whether a ref was stored.
 */
export async function captureSignupRef(
  userId: string,
  rawRef: string | null | undefined,
  client: Pick<typeof db, "user"> = db,
): Promise<boolean> {
  const ref = sanitizeRef(rawRef);
  if (!ref) return false;
  try {
    await client.user.update({ where: { id: userId }, data: { lwRef: ref } });
    return true;
  } catch (err) {
    captureError(err, { at: "attribution.captureSignupRef", userId });
    return false;
  }
}

export type SignupContext = {
  /** The account that owns the product this signup belongs to. */
  accountId: string;
  /** True when this is the account's first-ever tracked signup. */
  firstSignup: boolean;
};

/**
 * Owner + first-signup flag for a short code, read AFTER a signup was ingested.
 * Powers the `pixel_installed` activation event: the first signup that arrives
 * proves the pixel is live on the product's thank-you page.
 */
export async function signupContext(shortCode: string): Promise<SignupContext | null> {
  const link = await db.trackedLink.findUnique({
    where: { shortCode },
    include: {
      post: {
        include: {
          ship: { include: { project: { select: { userId: true } } } },
        },
      },
    },
  });
  if (!link) return null;
  const accountId = link.post.ship.project.userId;
  const signups = await db.event.count({
    where: {
      type: "SIGNUP",
      trackedLink: { post: { ship: { project: { userId: accountId } } } },
    },
  });
  return { accountId, firstSignup: signups === 1 };
}

// ── Pixel verification (see lib/pixel.ts for the served script) ────────────

export type PixelPingResult = {
  ok: boolean;
  /** True when this ping flipped the project from never-verified to verified. */
  first: boolean;
  /** Owner account id (for the pixel_installed funnel event); null if unknown. */
  accountId: string | null;
};

/**
 * Record a pixel verification ping: stamp `Project.pixelVerifiedAt`. Unknown
 * project ids are acknowledged but not recorded (the endpoint is public).
 */
export async function recordPixelPing(projectId: string): Promise<PixelPingResult> {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { id: true, userId: true, pixelVerifiedAt: true },
  });
  if (!project) return { ok: false, first: false, accountId: null };

  await db.project.update({
    where: { id: project.id },
    data: { pixelVerifiedAt: new Date() },
  });
  return {
    ok: true,
    first: project.pixelVerifiedAt === null,
    accountId: project.userId,
  };
}

// ── Self-reported attribution (dark social) ────────────────────────────────

export type SelfReportInput = {
  /** The raw answer — a chosen option key or free text. */
  answer: string;
  /** The lw_ref present at the same moment, if any (null = no tracked click). */
  lwRef?: string | null;
};

export type SelfReportResult = {
  ok: boolean;
  /** True when this is the project's first-ever self-report (activation signal). */
  first: boolean;
  /** Owner account id (for the survey_installed funnel event); null if unknown. */
  accountId: string | null;
};

/**
 * Record one self-reported "how did you hear about us?" answer for a project.
 * Normalizes the answer into the shared source taxonomy and stores the tracked
 * ref (if any) alongside it, so getSelfReportRollup can later measure how often
 * the link-based attribution disagreed with what the human said. Unknown project
 * ids are acknowledged but not stored (the endpoint is public + CORS-open).
 */
export async function recordSelfReport(
  projectId: string,
  input: SelfReportInput,
): Promise<SelfReportResult> {
  const answer = (input.answer ?? "").trim();
  if (!answer) return { ok: false, first: false, accountId: null };

  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { id: true, userId: true },
  });
  if (!project) return { ok: false, first: false, accountId: null };

  const { source, platform } = normalizeSource(answer);
  const lwRef = input.lwRef?.trim() || null;

  const priorCount = await db.selfReport.count({ where: { projectId } });
  try {
    await db.selfReport.create({
      data: {
        projectId,
        answer: answer.slice(0, MAX_ANSWER_LEN),
        source,
        platform,
        lwRef,
      },
    });
  } catch (err) {
    // Fire-and-forget from a public beacon — never 500 a survey submission.
    captureError(err, { at: "attribution.recordSelfReport", projectId });
    return { ok: false, first: false, accountId: null };
  }
  return { ok: true, first: priorCount === 0, accountId: project.userId };
}

export type SelfReportView = SelfReportRollup & {
  insight: string | null;
  lastAt: Date | null;
};

/**
 * Per-project self-report rollup for Results: source breakdown, the dark-social
 * share, and the link-vs-reality divergence. Resolves each stored lw_ref back to
 * the channel's platform so the pure rollup can compare "what the link said"
 * against "what the person said".
 */
export async function getSelfReportRollup(
  projectId: string,
): Promise<SelfReportView> {
  const reports = await db.selfReport.findMany({
    where: { projectId },
    select: { source: true, lwRef: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  // Resolve the distinct tracked refs to their channel platform in one query.
  const refs = [...new Set(reports.map((r) => r.lwRef).filter((v): v is string => Boolean(v)))];
  const platformByRef = new Map<string, Platform>();
  if (refs.length > 0) {
    const links = await db.trackedLink.findMany({
      where: { shortCode: { in: refs } },
      select: { shortCode: true, post: { select: { channel: { select: { platform: true } } } } },
    });
    for (const l of links) platformByRef.set(l.shortCode, l.post.channel.platform);
  }

  const rows: SelfReportRow[] = reports.map((r) => ({
    source: r.source,
    hasRef: Boolean(r.lwRef),
    linkPlatform: r.lwRef ? platformByRef.get(r.lwRef) ?? null : null,
  }));

  const rollup = rollupSelfReports(rows);
  return {
    ...rollup,
    insight: buildSelfReportInsight(rollup),
    lastAt: reports[0]?.createdAt ?? null,
  };
}

/** Does the pixel route have a project to serve? (Existence check for GET.) */
export async function pixelProjectExists(projectId: string): Promise<boolean> {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { id: true },
  });
  return Boolean(project);
}

export type RevenueInput = {
  /** Amount in the smallest currency unit (e.g. cents). */
  amountCents: number;
  /** ISO currency code (defaults to "usd"). */
  currency?: string;
  /** Subscription/recurring revenue counts toward MRR. */
  recurring?: boolean;
  meta?: Record<string, unknown>;
};

export type IngestRevenueOptions = {
  /**
   * When set, enforce that the tracked link belongs to this project — for callers
   * with a verified project context (the per-project Stripe webhook). A mismatch
   * is refused with a captured warning so revenue can't be written across tenants.
   */
  projectId?: string;
  /**
   * Explicit trust for signature-verified server paths (the Stripe webhook,
   * LaunchWake's own billing/Polar). Ignored when `hmac` is supplied.
   */
  verified?: boolean;
  /**
   * Public path: verify `x-lw-signature` (HMAC-SHA256 of the raw body) against the
   * owning project's `webhookSecret`. A valid signature is trusted; anything else
   * (no secret configured, missing/bad signature) is recorded as verified=false.
   */
  hmac?: { rawBody: string; signature: string | null };
};

/**
 * Log REVENUE for a tracked link — the strongest signal: this channel didn't
 * just drive a signup, it drove money. Returns false if the code is unknown, the
 * amount is non-positive, or a verified caller's project doesn't own the link.
 *
 * The `verified` flag records whether we can vouch for the amount (see
 * IngestRevenueOptions). Untrusted revenue is still stored — Results just sums it
 * separately — so a founder sees it without it corrupting the trusted headline.
 */
export async function ingestRevenue(
  shortCode: string,
  input: RevenueInput,
  client: Pick<typeof db, "trackedLink" | "event"> = db,
  opts?: IngestRevenueOptions,
): Promise<boolean> {
  if (!Number.isFinite(input.amountCents) || input.amountCents <= 0) return false;
  const link = await client.trackedLink.findUnique({
    where: { shortCode },
    select: {
      id: true,
      post: {
        select: {
          ship: {
            select: { projectId: true, project: { select: { webhookSecret: true } } },
          },
        },
      },
    },
  });
  if (!link) return false;

  if (opts?.projectId && link.post.ship.projectId !== opts.projectId) {
    captureError(new Error("REVENUE tenant mismatch: link does not belong to project"), {
      at: "attribution.ingestRevenue.tenantMismatch",
      projectId: opts.projectId,
    });
    return false;
  }

  // Determine trust: a signed public call is verified iff the HMAC checks out;
  // server callers set `verified` explicitly; default trusted otherwise.
  let verified = true;
  if (opts?.hmac) {
    verified = verifyRevenueSignature(
      opts.hmac.rawBody,
      opts.hmac.signature,
      link.post.ship.project.webhookSecret,
    );
  } else if (typeof opts?.verified === "boolean") {
    verified = opts.verified;
  }

  await client.event.create({
    data: {
      trackedLinkId: link.id,
      type: "REVENUE",
      amountCents: Math.round(input.amountCents),
      currency: (input.currency ?? "usd").toLowerCase(),
      recurring: Boolean(input.recurring),
      verified,
      meta: input.meta ? (input.meta as object) : undefined,
    },
  });
  return true;
}

// ── Read side ──────────────────────────────────────────────

export type ResultRow = {
  postId: string;
  channelName: string;
  shipTitle: string;
  trackedUrl: string | null;
  postUrl: string | null;
  clicks: number;
  signups: number;
  conversion: number; // 0..1
  revenueCents: number;
  /** Portion of revenueCents from signature-verified (trusted) events. */
  verifiedRevenueCents: number;
  recurringCents: number;
  removed: boolean;
  /** Cached post-mortem coaching, if the founder has run it. */
  coaching: CoachResult | null;
};

/** Aggregate across all ships — "which channel actually brings customers". */
export type ChannelRollup = {
  channelName: string;
  posts: number;
  clicks: number;
  signups: number;
  conversion: number;
  revenueCents: number;
  verifiedRevenueCents: number;
  recurringCents: number;
};

/** ROI headline for a launch: effort in → clicks → signups → money out. */
export type RoiSummary = {
  posts: number;
  effortMinutes: number;
  effortLabel: string;
  clicks: number;
  signups: number;
  revenueCents: number;
  recurringCents: number;
  currency: string;
};

export type ResultsRollup = {
  perPost: ResultRow[];
  perChannel: ChannelRollup[];
  totalClicks: number;
  totalSignups: number;
  conversion: number;
  totalRevenueCents: number;
  /** Sum of trusted (signature-verified) revenue only — the safe-to-quote figure. */
  totalVerifiedRevenueCents: number;
  mrrCents: number;
  currency: string;
  bestChannel: string | null;
  /** Channel that drove the most revenue (the flagship line). */
  topRevenueChannel: { name: string; revenueCents: number } | null;
  roi: RoiSummary;
  insight: string | null;
};

/**
 * Rough effort estimate for a launch: ~18 min per channel to tailor the draft,
 * post it, and engage. Deliberately conservative — the point is to contrast a
 * couple hours of work against the outcome.
 */
export function estimateEffortMinutes(posts: number): number {
  return posts * 18;
}

export function formatEffort(minutes: number): string {
  if (minutes <= 0) return "0m";
  if (minutes < 60) return `${minutes}m`;
  const h = minutes / 60;
  // one decimal below 10h, else whole hours
  const val = h < 10 ? Math.round(h * 10) / 10 : Math.round(h);
  return `${val}h`;
}

/** Format a smallest-unit amount as money (e.g. 34000, "usd" → "$340"). */
export function formatMoney(cents: number, currency = "usd"): string {
  try {
    const fmt = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
      maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
    });
    return fmt.format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(0)} ${currency.toUpperCase()}`;
  }
}

/**
 * Per-channel/post/total attribution rollup. Pass `shipId` to scope it to one
 * launch (the plan-level ROI summary); omit it for the project-wide Results.
 */
export async function getResultsRollup(
  projectId: string,
  opts?: { shipId?: string },
): Promise<ResultsRollup> {
  const posts = await db.post.findMany({
    where: {
      ship: opts?.shipId ? { id: opts.shipId, projectId } : { projectId },
    },
    include: {
      channel: { select: { name: true } },
      ship: { select: { title: true } },
      trackedLink: {
        include: {
          events: {
            select: {
              type: true,
              amountCents: true,
              recurring: true,
              currency: true,
              verified: true,
            },
          },
        },
      },
    },
    orderBy: { postedAt: "desc" },
  });

  let currency = "usd";

  const perPost: ResultRow[] = posts.map((p) => {
    const events = p.trackedLink?.events ?? [];
    let clicks = 0;
    let signups = 0;
    let revenueCents = 0;
    let verifiedRevenueCents = 0;
    let recurringCents = 0;
    for (const e of events) {
      if (e.type === "CLICK") clicks += 1;
      else if (e.type === "SIGNUP") signups += 1;
      else if (e.type === "REVENUE") {
        const amt = e.amountCents ?? 0;
        revenueCents += amt;
        if (e.verified) verifiedRevenueCents += amt;
        if (e.recurring) recurringCents += amt;
        if (e.currency) currency = e.currency;
      }
    }
    return {
      postId: p.id,
      channelName: p.channel.name,
      shipTitle: p.ship.title,
      trackedUrl: p.trackedLink ? trackedUrl(p.trackedLink.shortCode) : null,
      postUrl: p.url,
      clicks,
      signups,
      conversion: clicks > 0 ? signups / clicks : 0,
      revenueCents,
      verifiedRevenueCents,
      recurringCents,
      removed: p.status === "REMOVED",
      coaching: (p.coachingJson as CoachResult | null) ?? null,
    };
  });

  // Roll up by channel across ships.
  const byChannel = new Map<string, ChannelRollup>();
  for (const r of perPost) {
    const c =
      byChannel.get(r.channelName) ??
      {
        channelName: r.channelName,
        posts: 0,
        clicks: 0,
        signups: 0,
        conversion: 0,
        revenueCents: 0,
        verifiedRevenueCents: 0,
        recurringCents: 0,
      };
    c.posts += 1;
    c.clicks += r.clicks;
    c.signups += r.signups;
    c.revenueCents += r.revenueCents;
    c.verifiedRevenueCents += r.verifiedRevenueCents;
    c.recurringCents += r.recurringCents;
    byChannel.set(r.channelName, c);
  }
  const perChannel = [...byChannel.values()]
    .map((c) => ({ ...c, conversion: c.clicks > 0 ? c.signups / c.clicks : 0 }))
    .sort(
      (a, b) =>
        b.revenueCents - a.revenueCents ||
        b.signups - a.signups ||
        b.conversion - a.conversion,
    );

  const totalClicks = perPost.reduce((n, r) => n + r.clicks, 0);
  const totalSignups = perPost.reduce((n, r) => n + r.signups, 0);
  const totalRevenueCents = perPost.reduce((n, r) => n + r.revenueCents, 0);
  const totalVerifiedRevenueCents = perPost.reduce((n, r) => n + r.verifiedRevenueCents, 0);
  const mrrCents = perPost.reduce((n, r) => n + r.recurringCents, 0);
  const postCount = perPost.length;
  const effortMinutes = estimateEffortMinutes(postCount);

  const topRev = perChannel.find((c) => c.revenueCents > 0) ?? null;

  return {
    perPost,
    perChannel,
    totalClicks,
    totalSignups,
    conversion: totalClicks > 0 ? totalSignups / totalClicks : 0,
    totalRevenueCents,
    totalVerifiedRevenueCents,
    mrrCents,
    currency,
    bestChannel: perChannel.find((c) => c.signups > 0)?.channelName ?? null,
    topRevenueChannel: topRev
      ? { name: topRev.channelName, revenueCents: topRev.revenueCents }
      : null,
    roi: {
      posts: postCount,
      effortMinutes,
      effortLabel: formatEffort(effortMinutes),
      clicks: totalClicks,
      signups: totalSignups,
      revenueCents: totalRevenueCents,
      recurringCents: mrrCents,
      currency,
    },
    insight: buildInsight(perPost),
  };
}

export type TrackingStatus = {
  signups: number;
  clicks: number;
  lastSignupAt: Date | null;
  revenueEvents: number;
  revenueCents: number;
  currency: string;
  lastRevenueAt: Date | null;
  /** Self-reported "how did you hear" answers captured via the survey snippet. */
  selfReports: number;
  lastSelfReportAt: Date | null;
};

/** For the Settings pixel card — is data actually flowing in? */
export async function getTrackingStatus(
  projectId: string,
): Promise<TrackingStatus> {
  const where = {
    trackedLink: { post: { ship: { projectId } } },
  } as const;
  const [signups, clicks, last, revAgg, lastRev, selfReports, lastSelf] = await Promise.all([
    db.event.count({ where: { ...where, type: "SIGNUP" } }),
    db.event.count({ where: { ...where, type: "CLICK" } }),
    db.event.findFirst({
      where: { ...where, type: "SIGNUP" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    db.event.aggregate({
      where: { ...where, type: "REVENUE" },
      _sum: { amountCents: true },
      _count: { _all: true },
    }),
    db.event.findFirst({
      where: { ...where, type: "REVENUE" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, currency: true },
    }),
    db.selfReport.count({ where: { projectId } }),
    db.selfReport.findFirst({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);
  return {
    signups,
    clicks,
    lastSignupAt: last?.createdAt ?? null,
    revenueEvents: revAgg._count._all,
    revenueCents: revAgg._sum.amountCents ?? 0,
    currency: lastRev?.currency ?? "usd",
    lastRevenueAt: lastRev?.createdAt ?? null,
    selfReports,
    lastSelfReportAt: lastSelf?.createdAt ?? null,
  };
}

/**
 * Heuristic "What LaunchWake sees" line (double down / avoid). Deterministic and
 * free — no LLM call on every Results view.
 */
export function buildInsight(rows: ResultRow[]): string | null {
  if (rows.length === 0) return null;

  const removed = rows.filter((r) => r.removed);

  // Revenue is the strongest signal — lead with it when we have it.
  const earning = rows
    .filter((r) => r.revenueCents > 0)
    .sort((a, b) => b.revenueCents - a.revenueCents);
  if (earning.length > 0) {
    const top = earning[0];
    const parts = [
      `${top.channelName} drove ${formatMoney(top.revenueCents)} in attributed revenue${
        top.recurringCents > 0 ? ` (${formatMoney(top.recurringCents)} recurring)` : ""
      } — your best channel by money, not just signups.`,
    ];
    if (earning[1]) {
      parts.push(`${earning[1].channelName} is second at ${formatMoney(earning[1].revenueCents)}.`);
    }
    parts.push(`For the next ship, put your best effort into ${top.channelName}.`);
    return parts.join(" ");
  }

  const converting = rows
    .filter((r) => !r.removed && r.signups > 0)
    .sort((a, b) => b.conversion - a.conversion);

  if (converting.length === 0) {
    if (removed.length > 0) {
      return `Nothing has converted yet, and ${removed[0].channelName} removed your post — skip it and lead with a value-first angle next time.`;
    }
    return "Clicks are coming in but no signups yet — check that the tracking pixel is installed on your signup success page.";
  }

  const best = converting[0];
  const parts = [
    `${best.channelName} converts best for this product (${(best.conversion * 100).toFixed(1)}% on ${best.shipTitle}).`,
  ];
  if (converting[1]) {
    parts.push(`${converting[1].channelName} is a solid second.`);
  }
  if (removed.length > 0) {
    parts.push(`Skip ${removed[0].channelName} — your post there was removed.`);
  }
  parts.push(`For the next ship, double down on ${best.channelName}.`);
  return parts.join(" ");
}
