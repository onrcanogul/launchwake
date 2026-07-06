import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import { generateKeyPairSync } from "crypto";

/**
 * The GitHub App token path needs the App env set BEFORE lib/env loads, so this
 * file imports lib/github dynamically after stubbing a real RSA key. Kept
 * separate from github.test.ts (which statically imports the pure helpers).
 */
describe("GitHub App installation tokens", () => {
  let gh: typeof import("./github");

  beforeAll(async () => {
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    process.env.GITHUB_APP_ID = "123456";
    process.env.GITHUB_APP_PRIVATE_KEY = privateKey
      .export({ type: "pkcs8", format: "pem" })
      .toString();
    process.env.GITHUB_APP_SLUG = "launchwake-app";
    process.env.GITHUB_APP_WEBHOOK_SECRET = "whsec_test";
    gh = await import("./github");
  });

  afterEach(() => {
    gh.__clearInstallationTokenCache();
    vi.unstubAllGlobals();
  });

  function mockTokenFetch(token: string, expiresAt: string) {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ token, expires_at: expiresAt }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("signs a 3-part RS256 app JWT", () => {
    const jwt = gh.generateAppJwt(1_700_000_000_000);
    const parts = jwt.split(".");
    expect(parts).toHaveLength(3);
    const header = JSON.parse(
      Buffer.from(parts[0], "base64url").toString("utf8"),
    );
    expect(header).toEqual({ alg: "RS256", typ: "JWT" });
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8"),
    );
    expect(payload.iss).toBe("123456");
    expect(payload.exp - payload.iat).toBe(600);
  });

  it("caches the installation token until it nears expiry", async () => {
    const future = new Date(Date.now() + 3_600_000).toISOString();
    const fetchMock = mockTokenFetch("tok_1", future);
    const now = Date.now();
    const a = await gh.getInstallationToken("inst_1", now);
    const b = await gh.getInstallationToken("inst_1", now + 1_000);
    expect(a).toBe("tok_1");
    expect(b).toBe("tok_1");
    expect(fetchMock).toHaveBeenCalledTimes(1); // second call hit the cache
  });

  it("re-fetches when the cached token is inside the skew window", async () => {
    const soon = new Date(Date.now() + 5_000).toISOString(); // < 60s skew
    const fetchMock = mockTokenFetch("tok_2", soon);
    const now = Date.now();
    await gh.getInstallationToken("inst_2", now);
    await gh.getInstallationToken("inst_2", now + 1_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("caches per installation id", async () => {
    const future = new Date(Date.now() + 3_600_000).toISOString();
    const fetchMock = mockTokenFetch("tok_x", future);
    const now = Date.now();
    await gh.getInstallationToken("inst_a", now);
    await gh.getInstallationToken("inst_b", now);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws on a non-ok token response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 403 })),
    );
    await expect(gh.getInstallationToken("inst_err")).rejects.toThrow(/403/);
  });
});
