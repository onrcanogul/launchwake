import { describe, it, expect } from "vitest";
import {
  parseRepo,
  parseWebhookEvent,
  verifyWebhookSignature,
  verifyWebhookSignatureAny,
  installationIdFromPayload,
  mapInstallationRepoList,
  parseSetupCallback,
} from "./github";
import { createHmac } from "crypto";

describe("parseRepo", () => {
  it("parses owner/repo and GitHub URLs", () => {
    expect(parseRepo("hookline/api")).toEqual({ owner: "hookline", repo: "api" });
    expect(parseRepo("https://github.com/hookline/api.git")).toEqual({
      owner: "hookline",
      repo: "api",
    });
  });
  it("rejects junk", () => {
    expect(parseRepo("nope")).toBeNull();
  });
});

describe("parseWebhookEvent", () => {
  it("maps a published release to a ship", () => {
    const ship = parseWebhookEvent("release", {
      action: "published",
      repository: { full_name: "hookline/api" },
      release: {
        name: "v1.0 beta",
        tag_name: "v1.0",
        body: "First public beta",
        html_url: "https://github.com/hookline/api/releases/tag/v1.0",
      },
    });
    expect(ship?.repoFullName).toBe("hookline/api");
    expect(ship?.type).toBe("LAUNCH");
    expect(ship?.title).toBe("v1.0 beta");
  });

  it("ignores draft releases and non-published actions", () => {
    expect(
      parseWebhookEvent("release", {
        action: "created",
        repository: { full_name: "a/b" },
        release: { tag_name: "x" },
      }),
    ).toBeNull();
  });

  it("maps a default-branch push head commit", () => {
    const ship = parseWebhookEvent("push", {
      ref: "refs/heads/main",
      repository: { full_name: "hookline/api", default_branch: "main" },
      head_commit: {
        id: "abc123",
        message: "feat: Slack alerts\n\ndetails here",
        url: "https://github.com/hookline/api/commit/abc123",
      },
    });
    expect(ship?.title).toBe("feat: Slack alerts");
    expect(ship?.commitSha).toBe("abc123");
    expect(ship?.type).toBe("FEATURE");
  });

  it("ignores pushes to non-default branches and pings", () => {
    expect(
      parseWebhookEvent("push", {
        ref: "refs/heads/dev",
        repository: { full_name: "a/b", default_branch: "main" },
        head_commit: { message: "x" },
      }),
    ).toBeNull();
    expect(parseWebhookEvent("ping", { repository: { full_name: "a/b" } })).toBeNull();
  });
});

describe("verifyWebhookSignature", () => {
  it("accepts a correct signature and rejects a bad one", () => {
    const secret = "s3cr3t";
    const body = '{"hello":"world"}';
    const sig =
      "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
    expect(verifyWebhookSignature(body, sig, secret)).toBe(true);
    expect(verifyWebhookSignature(body, "sha256=deadbeef", secret)).toBe(false);
    expect(verifyWebhookSignature(body, null, secret)).toBe(false);
  });
});

describe("verifyWebhookSignatureAny", () => {
  const body = '{"a":1}';
  const sign = (secret: string) =>
    "sha256=" + createHmac("sha256", secret).update(body).digest("hex");

  it("passes when any candidate secret matches (App or manual)", () => {
    const sig = sign("app-secret");
    expect(
      verifyWebhookSignatureAny(body, sig, ["proj-secret", "app-secret", null]),
    ).toBe(true);
  });
  it("fails when no candidate matches, or all are empty", () => {
    expect(
      verifyWebhookSignatureAny(body, sign("x"), ["proj", "app"]),
    ).toBe(false);
    expect(verifyWebhookSignatureAny(body, sign("x"), [null, undefined, ""])).toBe(
      false,
    );
  });
});

describe("installationIdFromPayload", () => {
  it("reads a numeric or string installation id, else null", () => {
    expect(installationIdFromPayload({ installation: { id: 42 } })).toBe("42");
    expect(installationIdFromPayload({ installation: { id: "99" } })).toBe("99");
    expect(installationIdFromPayload({ repository: {} })).toBeNull();
    expect(installationIdFromPayload(null)).toBeNull();
  });
});

describe("mapInstallationRepoList", () => {
  it("maps fields, flags private, and sorts by most recent push", () => {
    const repos = mapInstallationRepoList({
      repositories: [
        {
          full_name: "acme/old",
          description: "older",
          html_url: "https://github.com/acme/old",
          private: false,
          pushed_at: "2024-01-01T00:00:00Z",
        },
        {
          full_name: "acme/secret",
          description: null,
          html_url: "https://github.com/acme/secret",
          private: true,
          pushed_at: "2026-06-01T00:00:00Z",
        },
      ],
    });
    expect(repos.map((r) => r.fullName)).toEqual(["acme/secret", "acme/old"]);
    expect(repos[0].private).toBe(true);
    expect(repos[0].description).toBeNull();
    expect(repos[1].fullName).toBe("acme/old");
  });
  it("handles an empty / missing repositories field", () => {
    expect(mapInstallationRepoList({})).toEqual([]);
    expect(mapInstallationRepoList({ repositories: [] })).toEqual([]);
  });
});

describe("parseSetupCallback", () => {
  it("accepts a valid callback and coerces the installation id", () => {
    const parsed = parseSetupCallback({
      installation_id: "12345",
      setup_action: "install",
      state: "project:proj_1",
    });
    expect(parsed).toEqual({
      installation_id: 12345,
      setup_action: "install",
      state: "project:proj_1",
    });
  });
  it("rejects a missing or non-numeric installation id", () => {
    expect(parseSetupCallback({ state: "onboarding" })).toBeNull();
    expect(parseSetupCallback({ installation_id: "abc" })).toBeNull();
  });
  it("reads from URLSearchParams too", () => {
    const sp = new URLSearchParams("installation_id=7&state=onboarding");
    expect(parseSetupCallback(sp)?.installation_id).toBe(7);
  });
});
