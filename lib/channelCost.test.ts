import { describe, it, expect } from "vitest";
import {
  parseChannelCost,
  costBadge,
  costPromptLine,
} from "./channelCost";

describe("parseChannelCost", () => {
  it("normalizes absent / null / undefined to free", () => {
    expect(parseChannelCost(undefined).type).toBe("free");
    expect(parseChannelCost(null).type).toBe("free");
  });

  it("normalizes a malformed value to free (never throws)", () => {
    expect(parseChannelCost({ type: "sponsored" }).type).toBe("free");
    expect(parseChannelCost("$39").type).toBe("free");
    expect(parseChannelCost(42).type).toBe("free");
  });

  it("passes through a valid paid/freemium value", () => {
    expect(parseChannelCost({ type: "paid", note: "from $39" })).toEqual({
      type: "paid",
      note: "from $39",
    });
    expect(parseChannelCost({ type: "freemium" }).type).toBe("freemium");
  });
});

describe("costBadge", () => {
  it("renders 'Paid · from $39' for a paid channel (the BetaList case)", () => {
    const badge = costBadge({ type: "paid", note: "from $39" });
    expect(badge?.label).toBe("Paid · from $39");
    expect(badge?.title).toContain("from $39");
  });

  it("renders 'Free + paid' for freemium, with the detail in the tooltip", () => {
    const badge = costBadge({ type: "freemium", note: "free queue; skip-the-line from $29.99" });
    expect(badge?.label).toBe("Free + paid");
    expect(badge?.title).toContain("$29.99");
  });

  it("renders no badge for free channels", () => {
    expect(costBadge({ type: "free" })).toBeNull();
  });

  it("falls back to a bare 'Paid' when there is no note", () => {
    expect(costBadge({ type: "paid" })?.label).toBe("Paid");
  });
});

describe("costPromptLine", () => {
  it("keeps free channels out of the prompt", () => {
    expect(costPromptLine({ type: "free" })).toBeNull();
  });

  it("emits a factual one-liner for paid/freemium", () => {
    expect(costPromptLine({ type: "paid", note: "from $39" })).toBe("paid — from $39");
    expect(costPromptLine({ type: "freemium" })).toBe("freemium");
  });
});
