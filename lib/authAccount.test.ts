import { describe, it, expect } from "vitest";
import type { AdapterAccount } from "next-auth/adapters";
import { pickAccountColumns } from "./authAccount";

describe("pickAccountColumns", () => {
  it("drops stray token fields that have no Account column (e.g. GitHub's refresh_token_expires_in)", () => {
    // Shape of what Auth.js hands linkAccount for a GitHub OAuth App with
    // expiring user tokens: { ...tokenResponse, provider, type, providerAccountId }.
    const account = {
      userId: "user_1",
      type: "oauth",
      provider: "github",
      providerAccountId: "12345",
      access_token: "gho_abc",
      refresh_token: "ghr_def",
      expires_at: 1_800_000_000,
      refresh_token_expires_in: 15_552_000,
      token_type: "bearer",
      scope: "read:user,user:email",
    } as unknown as AdapterAccount;

    const result = pickAccountColumns(account);

    expect(result).not.toHaveProperty("refresh_token_expires_in");
    expect(result).toEqual({
      userId: "user_1",
      type: "oauth",
      provider: "github",
      providerAccountId: "12345",
      access_token: "gho_abc",
      refresh_token: "ghr_def",
      expires_at: 1_800_000_000,
      token_type: "bearer",
      scope: "read:user,user:email",
    });
  });

  it("omits columns that are absent rather than writing undefined", () => {
    const account = {
      userId: "user_2",
      type: "oauth",
      provider: "github",
      providerAccountId: "678",
      access_token: "gho_xyz",
    } as unknown as AdapterAccount;

    const result = pickAccountColumns(account);

    expect(Object.keys(result).sort()).toEqual([
      "access_token",
      "provider",
      "providerAccountId",
      "type",
      "userId",
    ]);
    expect("id_token" in result).toBe(false);
  });
});
