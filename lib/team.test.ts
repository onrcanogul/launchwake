import { describe, it, expect } from "vitest";
import { newInviteToken, inviteUrl } from "./team";

describe("newInviteToken", () => {
  it("is URL-safe and unique across many draws", () => {
    const set = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const t = newInviteToken();
      expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(t.length).toBeGreaterThanOrEqual(12);
      set.add(t);
    }
    expect(set.size).toBe(300);
  });
});

describe("inviteUrl", () => {
  it("builds an /invite/{token} URL", () => {
    expect(inviteUrl("abc123")).toMatch(/\/invite\/abc123$/);
  });
});
