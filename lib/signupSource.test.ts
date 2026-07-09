import { describe, expect, it } from "vitest";
import { resolveHeardVia, SIGNUP_SOURCE_COOKIE, SIGNUP_LEAD_SOURCE } from "./signupSource";

describe("resolveHeardVia", () => {
  it("normalizes a chosen option key", () => {
    expect(resolveHeardVia("hackernews")).toBe("hackernews");
    expect(resolveHeardVia("word_of_mouth")).toBe("word_of_mouth");
  });

  it("normalizes free text into the shared taxonomy", () => {
    expect(resolveHeardVia("A friend told me")).toBe("word_of_mouth");
    expect(resolveHeardVia("twitter")).toBe("x");
  });

  it("returns null for empty / whitespace answers", () => {
    expect(resolveHeardVia("")).toBeNull();
    expect(resolveHeardVia("   ")).toBeNull();
    expect(resolveHeardVia(null)).toBeNull();
    expect(resolveHeardVia(undefined)).toBeNull();
  });

  it("maps unrecognized text to 'other' (still a valid attribution)", () => {
    expect(resolveHeardVia("a billboard on the highway")).toBe("other");
  });
});

describe("constants", () => {
  it("exposes stable storage keys", () => {
    expect(SIGNUP_SOURCE_COOKIE).toBe("lw_heard");
    expect(SIGNUP_LEAD_SOURCE).toBe("signup-heard");
  });
});
