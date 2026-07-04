import { describe, it, expect, vi, beforeEach } from "vitest";

// Integration test for the webhook → Ship creation path, with Prisma mocked.
vi.mock("./db", () => ({
  db: {
    project: { findFirst: vi.fn() },
    ship: { create: vi.fn() },
  },
}));

import { db } from "./db";
import { processGithubWebhook } from "./githubWebhook";

const mockDb = db as unknown as {
  project: { findFirst: ReturnType<typeof vi.fn> };
  ship: { create: ReturnType<typeof vi.fn> };
};

function releasePayload(name: string) {
  return JSON.stringify({
    action: "published",
    repository: { full_name: "acme/hookline" },
    release: {
      name,
      tag_name: name,
      body: "Shipped a thing worth sharing.",
      html_url: "https://github.com/acme/hookline/releases/tag/x",
      draft: false,
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("processGithubWebhook → Ship creation", () => {
  it("creates a Ship from a published release and returns its id + context", async () => {
    mockDb.project.findFirst.mockResolvedValue({
      id: "proj1",
      githubRepo: "acme/hookline",
      webhookSecret: null,
    });
    mockDb.ship.create.mockResolvedValue({ id: "ship1" });

    const result = await processGithubWebhook({
      rawBody: releasePayload("v0.4.0 — faster webhooks"),
      eventType: "release",
      signature: null,
    });

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ ok: true, shipId: "ship1" });
    expect(result.ship).toEqual({
      id: "ship1",
      projectId: "proj1",
      eventType: "release",
    });

    // The Ship carries the parsed suggestion (FEATURE, since not a 1.0/launch).
    expect(mockDb.ship.create).toHaveBeenCalledTimes(1);
    const arg = mockDb.ship.create.mock.calls[0][0];
    expect(arg.data).toMatchObject({
      projectId: "proj1",
      type: "FEATURE",
      title: "v0.4.0 — faster webhooks",
      sourceUrl: "https://github.com/acme/hookline/releases/tag/x",
    });
  });

  it("classifies a 1.0 release as a LAUNCH", async () => {
    mockDb.project.findFirst.mockResolvedValue({
      id: "proj1",
      githubRepo: "acme/hookline",
      webhookSecret: null,
    });
    mockDb.ship.create.mockResolvedValue({ id: "ship2" });

    await processGithubWebhook({
      rawBody: releasePayload("v1.0 — general availability"),
      eventType: "release",
      signature: null,
    });
    expect(mockDb.ship.create.mock.calls[0][0].data.type).toBe("LAUNCH");
  });

  it("ignores an event with no matching project (no Ship created)", async () => {
    mockDb.project.findFirst.mockResolvedValue(null);
    const result = await processGithubWebhook({
      rawBody: releasePayload("v0.4.0"),
      eventType: "release",
      signature: null,
    });
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ ignored: "no matching project" });
    expect(result.ship).toBeUndefined();
    expect(mockDb.ship.create).not.toHaveBeenCalled();
  });

  it("rejects a bad signature when the project has a secret (no Ship created)", async () => {
    mockDb.project.findFirst.mockResolvedValue({
      id: "proj1",
      githubRepo: "acme/hookline",
      webhookSecret: "s3cret",
    });
    const result = await processGithubWebhook({
      rawBody: releasePayload("v0.4.0"),
      eventType: "release",
      signature: "sha256=deadbeef",
    });
    expect(result.status).toBe(401);
    expect(mockDb.ship.create).not.toHaveBeenCalled();
  });

  it("400s on invalid JSON before touching the DB", async () => {
    const result = await processGithubWebhook({
      rawBody: "{not json",
      eventType: "release",
      signature: null,
    });
    expect(result.status).toBe(400);
    expect(mockDb.project.findFirst).not.toHaveBeenCalled();
  });

  it("ignores a draft release (parses to no suggestion)", async () => {
    mockDb.project.findFirst.mockResolvedValue({
      id: "proj1",
      githubRepo: "acme/hookline",
      webhookSecret: null,
    });
    const draft = JSON.stringify({
      action: "published",
      repository: { full_name: "acme/hookline" },
      release: { name: "v0.4.0", draft: true },
    });
    const result = await processGithubWebhook({
      rawBody: draft,
      eventType: "release",
      signature: null,
    });
    expect(result.body).toMatchObject({ ignored: true });
    expect(mockDb.ship.create).not.toHaveBeenCalled();
  });
});
