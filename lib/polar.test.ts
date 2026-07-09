import { describe, it, expect, vi } from "vitest";
import {
  planForProductId,
  seatsFromAmount,
  subscriptionPlanUpdate,
  attributePolarOrder,
  pickCancelableSubscription,
  type PolarProductIds,
} from "./polar";
import { TEAM_MIN_SEATS, TEAM_MAX_SEATS } from "./billing";

const ids: PolarProductIds = {
  pro: "prod_pro",
  proAnnual: "prod_annual",
  team: "prod_team",
};

describe("planForProductId", () => {
  it("maps Pro (monthly) and Pro Annual both to PRO", () => {
    expect(planForProductId("prod_pro", ids)).toBe("PRO");
    expect(planForProductId("prod_annual", ids)).toBe("PRO");
  });
  it("maps the Team product to TEAM", () => {
    expect(planForProductId("prod_team", ids)).toBe("TEAM");
  });
  it("returns null for the one-off Launch Pass and unknown products", () => {
    expect(planForProductId("prod_launchpass", ids)).toBeNull();
    expect(planForProductId("prod_unknown", ids)).toBeNull();
  });
  it("returns null for missing ids", () => {
    expect(planForProductId(null, ids)).toBeNull();
    expect(planForProductId(undefined, ids)).toBeNull();
    // Never match against an unconfigured (undefined) env product id.
    expect(planForProductId(undefined, {})).toBeNull();
  });
});

describe("seatsFromAmount", () => {
  it("derives seats from the total amount at $29/seat", () => {
    expect(seatsFromAmount(8700)).toBe(3); // 3 × 2900
    expect(seatsFromAmount(14500)).toBe(5); // 5 × 2900
  });
  it("clamps below the minimum and above the maximum", () => {
    expect(seatsFromAmount(2900)).toBe(TEAM_MIN_SEATS); // 1 seat → clamped up to min
    expect(seatsFromAmount(1_000_000)).toBe(TEAM_MAX_SEATS);
  });
  it("falls back to the minimum for zero/invalid amounts", () => {
    expect(seatsFromAmount(0)).toBe(TEAM_MIN_SEATS);
    expect(seatsFromAmount(-100)).toBe(TEAM_MIN_SEATS);
    expect(seatsFromAmount(Number.NaN)).toBe(TEAM_MIN_SEATS);
  });
});

describe("subscriptionPlanUpdate", () => {
  it("grants PRO while active/trialing", () => {
    expect(subscriptionPlanUpdate({ productId: "prod_pro", status: "active" }, ids)).toEqual({
      plan: "PRO",
      seats: 1,
    });
    expect(subscriptionPlanUpdate({ productId: "prod_pro", status: "trialing" }, ids)).toEqual({
      plan: "PRO",
      seats: 1,
    });
  });
  it("grants TEAM with seats derived from the amount", () => {
    expect(
      subscriptionPlanUpdate({ productId: "prod_team", status: "active", amount: 14500 }, ids),
    ).toEqual({ plan: "TEAM", seats: 5 });
  });
  it("downgrades to FREE on non-active status", () => {
    for (const status of ["canceled", "past_due", "unpaid", "incomplete"]) {
      expect(subscriptionPlanUpdate({ productId: "prod_team", status, amount: 8700 }, ids)).toEqual({
        plan: "FREE",
        seats: 1,
      });
    }
  });
  it("downgrades to FREE for an unmapped product even when active", () => {
    expect(subscriptionPlanUpdate({ productId: "prod_unknown", status: "active" }, ids)).toEqual({
      plan: "FREE",
      seats: 1,
    });
  });
});

describe("pickCancelableSubscription", () => {
  const sub = (id: string, status: string, cancelAtPeriodEnd = false) => ({
    id,
    status,
    cancelAtPeriodEnd,
  });

  it("returns null when there is no active subscription", () => {
    expect(pickCancelableSubscription([])).toBeNull();
    expect(
      pickCancelableSubscription([sub("s1", "canceled"), sub("s2", "past_due")]),
    ).toBeNull();
  });
  it("picks the active subscription", () => {
    expect(pickCancelableSubscription([sub("s1", "active")])?.id).toBe("s1");
    expect(pickCancelableSubscription([sub("s2", "trialing")])?.id).toBe("s2");
  });
  it("prefers an active sub not already scheduled to cancel", () => {
    const picked = pickCancelableSubscription([
      sub("scheduled", "active", true),
      sub("fresh", "active", false),
    ]);
    expect(picked?.id).toBe("fresh");
  });
  it("falls back to an active sub even if it's already scheduled to cancel", () => {
    expect(
      pickCancelableSubscription([sub("only", "active", true)])?.id,
    ).toBe("only");
  });
  it("ignores non-active subscriptions when choosing", () => {
    const picked = pickCancelableSubscription([
      sub("dead", "canceled"),
      sub("live", "active"),
    ]);
    expect(picked?.id).toBe("live");
  });
});

describe("attributePolarOrder (dogfood)", () => {
  type Client = NonNullable<Parameters<typeof attributePolarOrder>[1]>;

  function makeClient(opts: {
    users?: Array<{ id?: string; email?: string; lwRef: string | null }>;
    knownCodes?: string[];
  }) {
    const events: Array<Record<string, unknown>> = [];
    const known = new Set(opts.knownCodes ?? []);
    const users = opts.users ?? [];
    const client = {
      user: {
        findUnique: vi.fn(async ({ where }: { where: { id?: string; email?: string } }) => {
          const u = users.find(
            (x) => (where.id && x.id === where.id) || (where.email && x.email === where.email),
          );
          return u ? { id: u.id, lwRef: u.lwRef } : null;
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

  it("attributes a subscription renewal as recurring revenue via customer email", async () => {
    const { client, events } = makeClient({
      users: [{ id: "u1", email: "a@b.com", lwRef: "aB3xZ0q" }],
      knownCodes: ["aB3xZ0q"],
    });
    const ok = await attributePolarOrder(
      {
        id: "ord_1",
        customer: { email: "a@b.com" },
        netAmount: 2900,
        currency: "usd",
        billingReason: "subscription_cycle",
      },
      client,
    );
    expect(ok).toBe(true);
    expect(events[0]).toMatchObject({
      trackedLinkId: "link_aB3xZ0q",
      type: "REVENUE",
      amountCents: 2900,
      currency: "usd",
      recurring: true,
    });
  });

  it("resolves the paying user by metadata.userId", async () => {
    const { client, events } = makeClient({
      users: [{ id: "u2", email: "c@d.com", lwRef: "code2" }],
      knownCodes: ["code2"],
    });
    const ok = await attributePolarOrder(
      { id: "ord_2", metadata: { userId: "u2" }, totalAmount: 4900, currency: "usd", billingReason: "purchase" },
      client,
    );
    expect(ok).toBe(true);
    expect(events[0]).toMatchObject({ amountCents: 4900, recurring: false });
  });

  it("uses the lw_ref breadcrumb from checkout metadata without a user lookup", async () => {
    const { client, events } = makeClient({ knownCodes: ["breadcrumb"] });
    const ok = await attributePolarOrder(
      { id: "ord_3", metadata: { lw_ref: "breadcrumb" }, netAmount: 1900, billingReason: "purchase" },
      client,
    );
    expect(ok).toBe(true);
    expect(client.user.findUnique).not.toHaveBeenCalled();
    expect(events[0]).toMatchObject({ amountCents: 1900, recurring: false });
  });

  it("does nothing for an unknown customer (no channel ref)", async () => {
    const { client, events } = makeClient({ users: [{ email: "x@y.com", lwRef: null }] });
    expect(
      await attributePolarOrder({ id: "ord_4", customer: { email: "x@y.com" }, netAmount: 2900 }, client),
    ).toBe(false);
    expect(events).toHaveLength(0);
  });

  it("ignores zero-amount orders", async () => {
    const { client, events } = makeClient({
      users: [{ id: "u5", email: "a@b.com", lwRef: "aB3xZ0q" }],
      knownCodes: ["aB3xZ0q"],
    });
    expect(
      await attributePolarOrder({ id: "ord_5", customer: { email: "a@b.com" }, netAmount: 0 }, client),
    ).toBe(false);
    expect(events).toHaveLength(0);
  });
});
