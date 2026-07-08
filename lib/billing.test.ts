import { describe, it, expect, vi } from "vitest";
import {
  entitlementViolation,
  clampSeats,
  teamPriceCents,
  isPaidPlan,
  launchChannelLimit,
  launchChannelPaywall,
  attributeInvoiceRevenue,
  FREE_LAUNCH_CHANNELS,
  TEAM_MIN_SEATS,
  TEAM_MAX_SEATS,
  TEAM_PRICE_PER_SEAT_CENTS,
  type PlanUsage,
} from "./billing";

const free = (over: Partial<PlanUsage> = {}): PlanUsage => ({
  plan: "FREE",
  seats: 1,
  projectCount: 0,
  projectLimit: 1,
  plansThisMonth: 0,
  planLimit: 2,
  intentQueryCount: 0,
  intentQueryLimit: 0,
  ...over,
});

const paid = (plan: "PRO" | "TEAM", over: Partial<PlanUsage> = {}): PlanUsage => ({
  plan,
  seats: plan === "TEAM" ? 3 : 1,
  projectCount: 9,
  projectLimit: null,
  plansThisMonth: 99,
  planLimit: null,
  intentQueryCount: 0,
  intentQueryLimit: plan === "TEAM" ? null : 3,
  ...over,
});

describe("entitlementViolation", () => {
  it("allows a first project on Free", () => {
    expect(entitlementViolation(free(), "create_project")).toBeNull();
  });
  it("blocks a second project on Free", () => {
    expect(
      entitlementViolation(free({ projectCount: 1 }), "create_project"),
    ).toMatch(/Upgrade to Pro/);
  });
  it("allows plans until the monthly cap", () => {
    expect(entitlementViolation(free({ plansThisMonth: 1 }), "create_plan")).toBeNull();
    expect(
      entitlementViolation(free({ plansThisMonth: 2 }), "create_plan"),
    ).toMatch(/2\/2/);
  });
  it("never blocks Pro or Team (unlimited)", () => {
    for (const plan of ["PRO", "TEAM"] as const) {
      expect(entitlementViolation(paid(plan), "create_project")).toBeNull();
      expect(entitlementViolation(paid(plan), "create_plan")).toBeNull();
    }
  });

  it("blocks Intent Radar on Free with an upsell", () => {
    expect(entitlementViolation(free(), "create_intent_query")).toMatch(/Pro feature/);
  });
  it("allows Intent Radar queries on Pro up to the cap, then upsells Team", () => {
    expect(entitlementViolation(paid("PRO", { intentQueryCount: 2 }), "create_intent_query")).toBeNull();
    expect(
      entitlementViolation(paid("PRO", { intentQueryCount: 3 }), "create_intent_query"),
    ).toMatch(/Upgrade to Team/);
  });
  it("never blocks Intent Radar on Team (unlimited)", () => {
    expect(
      entitlementViolation(paid("TEAM", { intentQueryCount: 999 }), "create_intent_query"),
    ).toBeNull();
  });
});

describe("isPaidPlan", () => {
  it("treats Pro and Team as paid, Free as not", () => {
    expect(isPaidPlan("FREE")).toBe(false);
    expect(isPaidPlan("PRO")).toBe(true);
    expect(isPaidPlan("TEAM")).toBe(true);
  });
});

describe("launch channel cap", () => {
  it("caps Free launches and leaves paid unlimited", () => {
    expect(launchChannelLimit("FREE")).toBe(FREE_LAUNCH_CHANNELS);
    expect(launchChannelLimit("PRO")).toBeNull();
    expect(launchChannelLimit("TEAM")).toBeNull();
  });
  it("shows paywall copy only when a Free plan exceeds the cap", () => {
    expect(launchChannelPaywall("FREE", FREE_LAUNCH_CHANNELS)).toBeNull();
    expect(launchChannelPaywall("FREE", FREE_LAUNCH_CHANNELS + 3)).toMatch(
      /Upgrade to Pro/,
    );
    expect(launchChannelPaywall("PRO", 12)).toBeNull();
  });
});

describe("clampSeats", () => {
  it("enforces the seat floor and ceiling", () => {
    expect(clampSeats(1)).toBe(TEAM_MIN_SEATS);
    expect(clampSeats(TEAM_MIN_SEATS)).toBe(TEAM_MIN_SEATS);
    expect(clampSeats(5)).toBe(5);
    expect(clampSeats(9999)).toBe(TEAM_MAX_SEATS);
    expect(clampSeats(NaN)).toBe(TEAM_MIN_SEATS);
  });
  it("rounds fractional seats", () => {
    expect(clampSeats(4.6)).toBe(5);
  });
});

describe("teamPriceCents", () => {
  it("is per-seat with a minimum (raises ARPU with seats)", () => {
    expect(teamPriceCents(3)).toBe(3 * TEAM_PRICE_PER_SEAT_CENTS); // $87 at $29/seat
    expect(teamPriceCents(1)).toBe(TEAM_MIN_SEATS * TEAM_PRICE_PER_SEAT_CENTS); // floored to 3
    expect(teamPriceCents(10)).toBe(10 * TEAM_PRICE_PER_SEAT_CENTS);
  });
});

describe("attributeInvoiceRevenue (dogfood)", () => {
  type Invoice = Parameters<typeof attributeInvoiceRevenue>[0];
  type Client = Parameters<typeof attributeInvoiceRevenue>[1];

  function makeClient(opts: {
    // customer id → the lwRef stored on that User (null = user exists, no ref;
    // absent = no such customer).
    lwRefByCustomer?: Record<string, string | null>;
    // short codes that resolve to a real TrackedLink in the DB.
    knownCodes?: string[];
  }) {
    const events: Array<Record<string, unknown>> = [];
    const known = new Set(opts.knownCodes ?? []);
    const client = {
      user: {
        findFirst: vi.fn(async ({ where }: { where: { stripeCustomerId: string } }) => {
          const ref = opts.lwRefByCustomer?.[where.stripeCustomerId];
          return ref === undefined ? null : { lwRef: ref };
        }),
      },
      trackedLink: {
        findUnique: vi.fn(async ({ where }: { where: { shortCode: string } }) =>
          known.has(where.shortCode) ? { id: `link_${where.shortCode}` } : null,
        ),
      },
      event: {
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          events.push(data);
          return data;
        }),
      },
    };
    return { client: client as unknown as Client, events };
  }

  it("attributes a paid subscription invoice as recurring revenue", async () => {
    const { client, events } = makeClient({
      lwRefByCustomer: { cus_1: "aB3xZ0q" },
      knownCodes: ["aB3xZ0q"],
    });
    const invoice: Invoice = {
      id: "in_1",
      customer: "cus_1",
      amount_paid: 2900,
      currency: "usd",
      subscription: "sub_1",
    };
    expect(await attributeInvoiceRevenue(invoice, client)).toBe(true);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      trackedLinkId: "link_aB3xZ0q",
      type: "REVENUE",
      amountCents: 2900,
      currency: "usd",
      recurring: true,
    });
  });

  it("resolves the customer whether it's an id string or an expanded object", async () => {
    const { client, events } = makeClient({
      lwRefByCustomer: { cus_1: "aB3xZ0q" },
      knownCodes: ["aB3xZ0q"],
    });
    const ok = await attributeInvoiceRevenue(
      { id: "in_2", customer: { id: "cus_1" }, amount_paid: 4900, currency: "usd", subscription: "sub_1" },
      client,
    );
    expect(ok).toBe(true);
    expect(events[0]).toMatchObject({ amountCents: 4900 });
  });

  it("marks a one-off charge (no subscription) as non-recurring", async () => {
    const { client, events } = makeClient({
      lwRefByCustomer: { cus_1: "aB3xZ0q" },
      knownCodes: ["aB3xZ0q"],
    });
    await attributeInvoiceRevenue({ id: "in_3", customer: "cus_1", amount_paid: 1500, currency: "usd" }, client);
    expect(events[0]).toMatchObject({ recurring: false });
  });

  // 2026-02-25.clover (the webhook's API version) dropped the top-level
  // `invoice.subscription`. Recurring must still be detected via the newer
  // signals, or renewals wouldn't count toward MRR.
  it("detects a subscription renewal via billing_reason (2026 API, no top-level subscription)", async () => {
    const { client, events } = makeClient({
      lwRefByCustomer: { cus_1: "aB3xZ0q" },
      knownCodes: ["aB3xZ0q"],
    });
    await attributeInvoiceRevenue(
      { id: "in_3b", customer: "cus_1", amount_paid: 2900, currency: "usd", billing_reason: "subscription_cycle" },
      client,
    );
    expect(events[0]).toMatchObject({ recurring: true });
  });

  it("detects a subscription via parent.subscription_details (2026 API shape)", async () => {
    const { client, events } = makeClient({
      lwRefByCustomer: { cus_1: "aB3xZ0q" },
      knownCodes: ["aB3xZ0q"],
    });
    await attributeInvoiceRevenue(
      {
        id: "in_3c",
        customer: "cus_1",
        amount_paid: 2900,
        currency: "usd",
        parent: { subscription_details: { subscription: "sub_9" } },
      },
      client,
    );
    expect(events[0]).toMatchObject({ recurring: true });
  });

  it("does nothing when the paying user carries no channel ref", async () => {
    const { client, events } = makeClient({ lwRefByCustomer: { cus_1: null } });
    expect(
      await attributeInvoiceRevenue({ id: "in_4", customer: "cus_1", amount_paid: 2900, subscription: "sub_1" }, client),
    ).toBe(false);
    expect(events).toHaveLength(0);
  });

  it("does nothing for an unknown customer or a non-positive amount", async () => {
    const unknown = makeClient({});
    expect(
      await attributeInvoiceRevenue({ id: "in_5", customer: "cus_x", amount_paid: 2900 }, unknown.client),
    ).toBe(false);

    const zero = makeClient({ lwRefByCustomer: { cus_1: "aB3xZ0q" }, knownCodes: ["aB3xZ0q"] });
    expect(
      await attributeInvoiceRevenue({ id: "in_6", customer: "cus_1", amount_paid: 0, subscription: "sub_1" }, zero.client),
    ).toBe(false);
    expect(zero.events).toHaveLength(0);
  });

  it("doesn't record when the stored ref no longer maps to a tracked link", async () => {
    const { client, events } = makeClient({
      lwRefByCustomer: { cus_1: "staleCode" },
      knownCodes: [], // the link was deleted
    });
    expect(
      await attributeInvoiceRevenue({ id: "in_7", customer: "cus_1", amount_paid: 2900, subscription: "sub_1" }, client),
    ).toBe(false);
    expect(events).toHaveLength(0);
  });
});
