import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHmac } from "crypto";

// ingestSignup uses the module-level Prisma singleton (not injectable), so mock
// it to unit-test the dedup + tenant-scope logic. ingestRevenue takes an
// injectable client and is tested with a local fake instead.
const dbMock = vi.hoisted(() => ({
  trackedLink: { findUnique: vi.fn() },
  event: { createMany: vi.fn(), findFirst: vi.fn() },
}));
vi.mock("./db", () => ({ db: dbMock }));
const captureErrorMock = vi.hoisted(() => vi.fn());
vi.mock("./observability", () => ({ captureError: captureErrorMock }));

import {
  generateShortCode,
  slugifyCampaign,
  buildDestUrl,
  buildInsight,
  estimateEffortMinutes,
  formatEffort,
  formatMoney,
  sanitizeRef,
  captureSignupRef,
  utcDayStamp,
  clickDedupeKey,
  signupDedupeKey,
  emailHash,
  mergeTouches,
  sanitizeTouches,
  verifyRevenueSignature,
  ingestSignup,
  ingestRevenue,
  recordSignup,
  type ResultRow,
} from "./attribution";

beforeEach(() => {
  dbMock.trackedLink.findUnique.mockReset();
  dbMock.event.createMany.mockReset();
  dbMock.event.findFirst.mockReset();
  captureErrorMock.mockReset();
});

describe("generateShortCode", () => {
  it("is URL-safe and the requested length", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateShortCode(7);
      expect(code).toHaveLength(7);
      expect(code).toMatch(/^[0-9A-Za-z]+$/);
    }
  });
  it("is effectively unique across many draws", () => {
    const set = new Set(Array.from({ length: 500 }, () => generateShortCode()));
    expect(set.size).toBe(500);
  });
});

describe("slugifyCampaign", () => {
  it("kebab-cases and strips punctuation", () => {
    expect(slugifyCampaign("Added Slack alerts for failed webhooks!")).toBe(
      "added-slack-alerts-for-failed-webhooks",
    );
  });
});

describe("buildDestUrl", () => {
  it("appends channel-specific UTM params", () => {
    const url = buildDestUrl(
      "https://hookline.dev/",
      "HACKERNEWS",
      "v1.0 beta",
    );
    const u = new URL(url);
    expect(u.searchParams.get("utm_source")).toBe("hackernews");
    expect(u.searchParams.get("utm_medium")).toBe("launchwake");
    expect(u.searchParams.get("utm_campaign")).toBe("v1-0-beta");
  });
  it("preserves existing query params", () => {
    const url = buildDestUrl("https://hookline.dev/?plan=pro", "X", "ship");
    const u = new URL(url);
    expect(u.searchParams.get("plan")).toBe("pro");
    expect(u.searchParams.get("utm_source")).toBe("x");
  });
});

describe("ROI helpers", () => {
  it("estimates ~18 min of effort per posted channel", () => {
    expect(estimateEffortMinutes(0)).toBe(0);
    expect(estimateEffortMinutes(7)).toBe(126); // ~2h
  });
  it("formats effort as minutes or hours", () => {
    expect(formatEffort(45)).toBe("45m");
    expect(formatEffort(126)).toBe("2.1h");
    expect(formatEffort(600)).toBe("10h");
  });
  it("formats money from cents with the currency", () => {
    expect(formatMoney(34000, "usd")).toBe("$340");
    expect(formatMoney(4999, "usd")).toBe("$49.99");
    expect(formatMoney(29000, "eur")).toBe("€290");
  });
});

function row(partial: Partial<ResultRow> & { channelName: string }): ResultRow {
  return {
    postId: "p1",
    shipTitle: "beta",
    trackedUrl: null,
    postUrl: null,
    clicks: 0,
    signups: 0,
    conversion: 0,
    revenueCents: 0,
    verifiedRevenueCents: 0,
    recurringCents: 0,
    removed: false,
    coaching: null,
    ...partial,
  };
}

describe("buildInsight", () => {
  it("returns null with no data", () => {
    expect(buildInsight([])).toBeNull();
  });
  it("recommends doubling down on the best converter", () => {
    const insight = buildInsight([
      row({ channelName: "Hacker News", clicks: 100, signups: 5, conversion: 0.05 }),
      row({ channelName: "X", clicks: 100, signups: 2, conversion: 0.02 }),
    ])!;
    expect(insight).toMatch(/Hacker News/);
    expect(insight).toMatch(/double down/i);
  });
  it("flags a removed post when nothing converts", () => {
    const insight = buildInsight([
      row({ channelName: "r/SaaS", clicks: 10, removed: true }),
    ])!;
    expect(insight).toMatch(/r\/SaaS/);
    expect(insight).toMatch(/skip/i);
  });
  it("leads with revenue when a channel earned money", () => {
    const insight = buildInsight([
      row({ channelName: "Hacker News", clicks: 100, signups: 8, conversion: 0.08 }),
      row({ channelName: "Product Hunt", clicks: 40, signups: 3, revenueCents: 34000, recurringCents: 29000 }),
    ])!;
    // Revenue trumps raw signup conversion for the headline.
    expect(insight).toMatch(/Product Hunt/);
    expect(insight).toMatch(/\$340/);
    expect(insight).toMatch(/recurring/i);
  });
});

describe("sanitizeRef", () => {
  it("accepts a base62 short code", () => {
    expect(sanitizeRef("aB3xZ0q")).toBe("aB3xZ0q");
    expect(sanitizeRef("  aB3xZ0q  ")).toBe("aB3xZ0q"); // trims surrounding space
  });
  it("rejects empty, missing, or over-long values", () => {
    expect(sanitizeRef("")).toBeNull();
    expect(sanitizeRef("   ")).toBeNull();
    expect(sanitizeRef(null)).toBeNull();
    expect(sanitizeRef(undefined)).toBeNull();
    expect(sanitizeRef("a".repeat(65))).toBeNull();
  });
  it("rejects anything that isn't a plain short code (injection guard)", () => {
    expect(sanitizeRef("abc-123")).toBeNull();
    expect(sanitizeRef("abc/../x")).toBeNull();
    expect(sanitizeRef("<script>")).toBeNull();
    expect(sanitizeRef("a b")).toBeNull();
  });
});

describe("captureSignupRef", () => {
  const clientWith = (update = vi.fn().mockResolvedValue({})) =>
    ({ user: { update } }) as unknown as Parameters<typeof captureSignupRef>[2];

  it("stores a valid ref on the user", async () => {
    const update = vi.fn().mockResolvedValue({});
    const ok = await captureSignupRef("user_1", "aB3xZ0q", clientWith(update));
    expect(ok).toBe(true);
    expect(update).toHaveBeenCalledWith({
      where: { id: "user_1" },
      data: { lwRef: "aB3xZ0q" },
    });
  });

  it("no-ops (no write) when the ref is absent or malformed", async () => {
    const update = vi.fn().mockResolvedValue({});
    expect(await captureSignupRef("user_1", undefined, clientWith(update))).toBe(false);
    expect(await captureSignupRef("user_1", "bad/ref", clientWith(update))).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it("swallows a write failure so sign-in never breaks", async () => {
    const update = vi.fn().mockRejectedValue(new Error("db down"));
    await expect(captureSignupRef("user_1", "aB3xZ0q", clientWith(update))).resolves.toBe(false);
  });
});

describe("dedupe keys", () => {
  const base = { ip: "203.0.113.7", userAgent: "Mozilla/5.0", shortCode: "aB3xZ0q", day: "2026-07-09" };

  it("utcDayStamp is the YYYY-MM-DD of a date (UTC)", () => {
    expect(utcDayStamp(new Date("2026-07-09T23:59:00.000Z"))).toBe("2026-07-09");
    expect(utcDayStamp(new Date("2026-07-10T00:00:00.000Z"))).toBe("2026-07-10");
  });

  it("clickDedupeKey is a deterministic 64-hex digest", () => {
    const k = clickDedupeKey(base);
    expect(k).toMatch(/^[0-9a-f]{64}$/);
    expect(clickDedupeKey(base)).toBe(k); // stable for the same inputs
  });

  it("clickDedupeKey changes with ip, UA, code, or day (so distinct clicks stay distinct)", () => {
    const k = clickDedupeKey(base);
    expect(clickDedupeKey({ ...base, ip: "198.51.100.2" })).not.toBe(k);
    expect(clickDedupeKey({ ...base, userAgent: "curl/8" })).not.toBe(k);
    expect(clickDedupeKey({ ...base, shortCode: "other12" })).not.toBe(k);
    expect(clickDedupeKey({ ...base, day: "2026-07-10" })).not.toBe(k);
  });

  it("signupDedupeKey prefers the lowercased email when present", () => {
    const a = signupDedupeKey({ ...base, email: "Founder@Example.com" });
    const b = signupDedupeKey({ ...base, email: "founder@example.com" });
    expect(a).toBe(b); // case-insensitive
    // Email identity ignores ip/UA/day/code — same person, one signup per link.
    expect(signupDedupeKey({ ip: "x", userAgent: "y", shortCode: "z", email: "founder@example.com" })).toBe(a);
  });

  it("signupDedupeKey falls back to the ip-based click key without an email", () => {
    expect(signupDedupeKey(base)).toBe(clickDedupeKey(base));
    expect(signupDedupeKey({ ...base, email: "" })).toBe(clickDedupeKey(base));
    expect(signupDedupeKey({ ...base, email: null })).toBe(clickDedupeKey(base));
  });

  it("an email-based key differs from the ip-based key", () => {
    expect(signupDedupeKey({ ...base, email: "a@b.com" })).not.toBe(clickDedupeKey(base));
  });
});

describe("verifyRevenueSignature", () => {
  const secret = "whsec_test_secret";
  const body = '{"ref":"aB3xZ0q","amountCents":4900}';
  const sign = (b: string, s: string) => createHmac("sha256", s).update(b).digest("hex");

  it("accepts a valid HMAC-SHA256 of the raw body", () => {
    expect(verifyRevenueSignature(body, sign(body, secret), secret)).toBe(true);
  });

  it("accepts a sha256=<hex> prefixed signature", () => {
    expect(verifyRevenueSignature(body, `sha256=${sign(body, secret)}`, secret)).toBe(true);
  });

  it("rejects a tampered body, wrong secret, or wrong signature", () => {
    expect(verifyRevenueSignature('{"amountCents":999900}', sign(body, secret), secret)).toBe(false);
    expect(verifyRevenueSignature(body, sign(body, "other"), secret)).toBe(false);
    expect(verifyRevenueSignature(body, "deadbeef".repeat(8), secret)).toBe(false);
  });

  it("rejects when the signature or secret is missing, or malformed", () => {
    expect(verifyRevenueSignature(body, null, secret)).toBe(false);
    expect(verifyRevenueSignature(body, sign(body, secret), null)).toBe(false);
    expect(verifyRevenueSignature(body, sign(body, secret), "")).toBe(false);
    expect(verifyRevenueSignature(body, "not-hex", secret)).toBe(false);
  });
});

describe("ingestSignup (dedup + tenant scope)", () => {
  const linkRow = { id: "link_1", post: { ship: { projectId: "proj_1" } } };

  it("records a new signup and returns true (count > 0)", async () => {
    dbMock.trackedLink.findUnique.mockResolvedValue(linkRow);
    dbMock.event.createMany.mockResolvedValue({ count: 1 });

    const ok = await ingestSignup("aB3xZ0q", { via: "pixel" }, { dedupeKey: "k1" });
    expect(ok).toBe(true);
    expect(dbMock.event.createMany).toHaveBeenCalledWith({
      data: [{ trackedLinkId: "link_1", type: "SIGNUP", dedupeKey: "k1", emailHash: null, meta: { via: "pixel" } }],
      skipDuplicates: true,
    });
  });

  it("returns false on a dedup (ON CONFLICT skipped → count 0) so pixel-installed never re-fires", async () => {
    dbMock.trackedLink.findUnique.mockResolvedValue(linkRow);
    dbMock.event.createMany.mockResolvedValue({ count: 0 });
    expect(await ingestSignup("aB3xZ0q", undefined, { dedupeKey: "k1" })).toBe(false);
  });

  it("returns false for an unknown short code without attempting a write", async () => {
    dbMock.trackedLink.findUnique.mockResolvedValue(null);
    expect(await ingestSignup("nope", undefined, { dedupeKey: "k" })).toBe(false);
    expect(dbMock.event.createMany).not.toHaveBeenCalled();
  });

  it("refuses a cross-tenant write and captures a warning", async () => {
    dbMock.trackedLink.findUnique.mockResolvedValue(linkRow);
    const ok = await ingestSignup("aB3xZ0q", undefined, { projectId: "proj_OTHER", dedupeKey: "k" });
    expect(ok).toBe(false);
    expect(dbMock.event.createMany).not.toHaveBeenCalled();
    expect(captureErrorMock).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ at: "attribution.ingestSignup.tenantMismatch", projectId: "proj_OTHER" }),
    );
  });

  it("allows the write when the verified project owns the link", async () => {
    dbMock.trackedLink.findUnique.mockResolvedValue(linkRow);
    dbMock.event.createMany.mockResolvedValue({ count: 1 });
    expect(await ingestSignup("aB3xZ0q", undefined, { projectId: "proj_1", dedupeKey: "k" })).toBe(true);
  });
});

describe("ingestRevenue (tenant scope + verified flag)", () => {
  type Client = Parameters<typeof ingestRevenue>[2];
  function makeClient(link: unknown) {
    const events: Array<Record<string, unknown>> = [];
    const client = {
      trackedLink: { findUnique: vi.fn(async () => link) },
      event: { create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => void events.push(data)) },
    };
    return { client: client as unknown as Client, events };
  }
  const link = (opts: { projectId?: string; secret?: string | null } = {}) => ({
    id: "link_1",
    post: { ship: { projectId: opts.projectId ?? "proj_1", project: { webhookSecret: opts.secret ?? null } } },
  });
  const input = { amountCents: 4900, currency: "usd", recurring: true };

  it("defaults to verified=true for trusted server callers", async () => {
    const { client, events } = makeClient(link());
    expect(await ingestRevenue("aB3xZ0q", input, client, { verified: true })).toBe(true);
    expect(events[0]).toMatchObject({ type: "REVENUE", amountCents: 4900, verified: true });
  });

  it("enforces tenant ownership and refuses a mismatch", async () => {
    const { client, events } = makeClient(link({ projectId: "proj_1" }));
    const ok = await ingestRevenue("aB3xZ0q", input, client, { projectId: "proj_OTHER", verified: true });
    expect(ok).toBe(false);
    expect(events).toHaveLength(0);
    expect(captureErrorMock).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ at: "attribution.ingestRevenue.tenantMismatch" }),
    );
  });

  it("records verified=true when the HMAC matches the project secret", async () => {
    const secret = "whsec_1";
    const body = '{"amountCents":4900}';
    const sig = createHmac("sha256", secret).update(body).digest("hex");
    const { client, events } = makeClient(link({ secret }));
    await ingestRevenue("aB3xZ0q", input, client, { hmac: { rawBody: body, signature: sig } });
    expect(events[0]).toMatchObject({ verified: true });
  });

  it("records verified=false for an unsigned/invalid public call (untrusted, but stored)", async () => {
    const { client, events } = makeClient(link({ secret: "whsec_1" }));
    await ingestRevenue("aB3xZ0q", input, client, { hmac: { rawBody: "{}", signature: null } });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ verified: false });
  });

  it("records verified=false when the project has no secret configured", async () => {
    const { client, events } = makeClient(link({ secret: null }));
    await ingestRevenue("aB3xZ0q", input, client, { hmac: { rawBody: "{}", signature: "deadbeef".repeat(8) } });
    expect(events[0]).toMatchObject({ verified: false });
  });

  it("rejects a non-positive amount before any lookup", async () => {
    const { client, events } = makeClient(link());
    expect(await ingestRevenue("aB3xZ0q", { amountCents: 0 }, client, { verified: true })).toBe(false);
    expect(events).toHaveLength(0);
  });
});

describe("emailHash", () => {
  it("is a deterministic, case/whitespace-insensitive 64-hex digest", () => {
    const a = emailHash("Founder@Example.com");
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(emailHash("  founder@example.com ")).toBe(a);
  });
  it("differs for different emails", () => {
    expect(emailHash("a@b.com")).not.toBe(emailHash("c@d.com"));
  });
});

describe("sanitizeTouches", () => {
  it("keeps valid short codes, deduped, order preserved, capped at 3", () => {
    expect(sanitizeTouches(["c1", "c2", "c1", "c3", "c4"])).toEqual(["c1", "c2", "c3"]);
  });
  it("drops blanks, non-strings, and injection-y values", () => {
    expect(sanitizeTouches(["c1", "", "a/b", 5, null, "<script>", "c2"])).toEqual(["c1", "c2"]);
  });
  it("returns [] for non-arrays", () => {
    expect(sanitizeTouches(undefined)).toEqual([]);
    expect(sanitizeTouches("c1")).toEqual([]);
    expect(sanitizeTouches(null)).toEqual([]);
  });
});

describe("mergeTouches", () => {
  it("prepends the newest touch (most-recent first)", () => {
    expect(mergeTouches(["c1", "c2"], "c3")).toEqual(["c3", "c1", "c2"]);
  });
  it("moves an existing code to the front instead of duplicating", () => {
    expect(mergeTouches(["c1", "c2", "c3"], "c2")).toEqual(["c2", "c1", "c3"]);
  });
  it("caps at 3, dropping the oldest", () => {
    expect(mergeTouches(["c1", "c2", "c3"], "c4")).toEqual(["c4", "c1", "c2"]);
  });
  it("is a no-op for an invalid incoming code", () => {
    expect(mergeTouches(["c1", "c2"], "a/b")).toEqual(["c1", "c2"]);
    expect(mergeTouches(["c1"], "")).toEqual(["c1"]);
  });
});

describe("recordSignup (attribution orchestration)", () => {
  const cap = (over: Partial<Parameters<typeof recordSignup>[0]> = {}) => ({
    touches: [],
    ip: "203.0.113.7",
    userAgent: "Mozilla/5.0",
    via: "beacon",
    ...over,
  });
  const link = (projectId = "proj_1") => ({ id: "link_1", post: { ship: { projectId } } });

  it("attributes last-touch to touches[0] and persists all touches in meta", async () => {
    dbMock.trackedLink.findUnique.mockResolvedValue(link());
    dbMock.event.createMany.mockResolvedValue({ count: 1 });

    const out = await recordSignup(cap({ touches: ["c1", "c2"], email: "u@x.com" }));
    expect(out).toMatchObject({ ok: true, attributed: true, mode: "last-touch", shortCode: "c1" });
    const data = dbMock.event.createMany.mock.calls[0][0].data[0];
    expect(data).toMatchObject({ type: "SIGNUP", trackedLinkId: "link_1" });
    expect(data.meta.touches).toEqual(["c1", "c2"]);
    expect(data.emailHash).toBe(emailHash("u@x.com"));
  });

  it("recovers cross-device via a CLICK with a matching emailHash when no ref is present", async () => {
    // findClickByEmailHash → shortCode, then ingestSignup resolves that link.
    dbMock.event.findFirst.mockResolvedValue({ trackedLink: { shortCode: "c9" } });
    dbMock.trackedLink.findUnique.mockResolvedValue(link("proj_1"));
    dbMock.event.createMany.mockResolvedValue({ count: 1 });

    const out = await recordSignup(cap({ touches: [], email: "u@x.com", projectId: "proj_1" }));
    expect(out).toMatchObject({ ok: true, attributed: true, mode: "email-recovery", shortCode: "c9" });
    expect(dbMock.event.findFirst).toHaveBeenCalled();
  });

  it("records an unattributed signup (link-less) when there's no ref and no email match", async () => {
    dbMock.event.findFirst.mockResolvedValue(null); // no matching click
    dbMock.event.createMany.mockResolvedValue({ count: 1 });

    const out = await recordSignup(cap({ touches: [], email: "u@x.com", projectId: "proj_1" }));
    expect(out).toMatchObject({ ok: true, attributed: false, mode: "unattributed", shortCode: null });
    const data = dbMock.event.createMany.mock.calls[0][0].data[0];
    expect(data).toMatchObject({ projectId: "proj_1", trackedLinkId: null, type: "SIGNUP" });
    expect(data.meta.channel).toBe("unattributed");
  });

  it("records unattributed with no email at all (pure dark social) when a project is known", async () => {
    dbMock.event.createMany.mockResolvedValue({ count: 1 });
    const out = await recordSignup(cap({ touches: [], projectId: "proj_1" }));
    expect(out.mode).toBe("unattributed");
    expect(dbMock.event.findFirst).not.toHaveBeenCalled(); // no email → no recovery lookup
  });

  it("skips (records nothing) when there's no ref, no email, and no project", async () => {
    const out = await recordSignup(cap({ touches: [] }));
    expect(out).toMatchObject({ ok: false, attributed: false, mode: "skipped", shortCode: null });
    expect(dbMock.event.createMany).not.toHaveBeenCalled();
  });
});
