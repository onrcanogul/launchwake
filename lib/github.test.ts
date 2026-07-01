import { describe, it, expect } from "vitest";
import { parseRepo, parseWebhookEvent, verifyWebhookSignature } from "./github";
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
