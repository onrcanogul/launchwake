import { describe, expect, it } from "vitest";
import {
  emailFooter,
  unsubscribeToken,
  unsubscribeUrl,
  verifyUnsubscribeToken,
} from "./emailPrefs";

const SECRET = "test-secret-abc";
const USER = "user_123";

describe("unsubscribe tokens", () => {
  it("is deterministic per (user, secret)", () => {
    expect(unsubscribeToken(USER, SECRET)).toBe(unsubscribeToken(USER, SECRET));
    expect(unsubscribeToken(USER, SECRET)).toMatch(/^[0-9a-f]{32}$/);
  });

  it("verifies a genuine token", () => {
    const token = unsubscribeToken(USER, SECRET);
    expect(verifyUnsubscribeToken(USER, token, SECRET)).toBe(true);
  });

  it("rejects a token for another user or secret", () => {
    const token = unsubscribeToken(USER, SECRET);
    expect(verifyUnsubscribeToken("user_456", token, SECRET)).toBe(false);
    expect(verifyUnsubscribeToken(USER, token, "other-secret")).toBe(false);
  });

  it("rejects malformed tokens without throwing", () => {
    expect(verifyUnsubscribeToken(USER, "", SECRET)).toBe(false);
    expect(verifyUnsubscribeToken(USER, "short", SECRET)).toBe(false);
    expect(verifyUnsubscribeToken(USER, "z".repeat(32), SECRET)).toBe(false);
  });
});

describe("unsubscribeUrl", () => {
  it("builds the one-click link with user + token", () => {
    const url = unsubscribeUrl("https://www.launchwake.com/", USER, SECRET);
    expect(url).toBe(
      `https://www.launchwake.com/api/email/unsubscribe?u=${USER}&t=${unsubscribeToken(USER, SECRET)}`,
    );
  });
});

describe("emailFooter", () => {
  it("includes the unsubscribe link", () => {
    const footer = emailFooter("https://example.com/u");
    expect(footer).toContain("unsubscribe");
    expect(footer).toContain("https://example.com/u");
  });
});
