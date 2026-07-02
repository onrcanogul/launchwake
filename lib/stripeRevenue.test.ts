import { describe, it, expect } from "vitest";
import { parseStripeRevenue } from "./stripeRevenue";

describe("parseStripeRevenue", () => {
  it("attributes a one-time checkout with lw_ref", () => {
    const r = parseStripeRevenue({
      type: "checkout.session.completed",
      data: {
        object: {
          mode: "payment",
          amount_total: 4900,
          currency: "usd",
          metadata: { lw_ref: "abc123" },
        },
      },
    });
    expect(r).toEqual({ ref: "abc123", amountCents: 4900, currency: "usd", recurring: false });
  });

  it("marks subscription checkouts as recurring (MRR)", () => {
    const r = parseStripeRevenue({
      type: "checkout.session.completed",
      data: {
        object: { mode: "subscription", amount_total: 2900, currency: "usd", metadata: { lw_ref: "sub1" } },
      },
    });
    expect(r?.recurring).toBe(true);
  });

  it("attributes a subscription invoice and reads amount_paid", () => {
    const r = parseStripeRevenue({
      type: "invoice.payment_succeeded",
      data: {
        object: {
          amount_paid: 2900,
          currency: "usd",
          subscription: "sub_123",
          metadata: { lw_ref: "inv1" },
        },
      },
    });
    expect(r).toEqual({ ref: "inv1", amountCents: 2900, currency: "usd", recurring: true });
  });

  it("finds lw_ref on subscription_details or line metadata", () => {
    const r = parseStripeRevenue({
      type: "invoice.paid",
      data: {
        object: {
          amount_paid: 1000,
          currency: "usd",
          subscription: "sub_9",
          subscription_details: { metadata: { lw_ref: "fromSub" } },
        },
      },
    });
    expect(r?.ref).toBe("fromSub");
  });

  it("ignores events without an lw_ref", () => {
    expect(
      parseStripeRevenue({
        type: "checkout.session.completed",
        data: { object: { mode: "payment", amount_total: 4900, currency: "usd", metadata: {} } },
      }),
    ).toBeNull();
  });

  it("ignores unrelated event types and zero amounts", () => {
    expect(
      parseStripeRevenue({ type: "customer.created", data: { object: { metadata: { lw_ref: "x" } } } }),
    ).toBeNull();
    expect(
      parseStripeRevenue({
        type: "checkout.session.completed",
        data: { object: { mode: "payment", amount_total: 0, currency: "usd", metadata: { lw_ref: "x" } } },
      }),
    ).toBeNull();
  });
});
