import { describe, it, expect, vi, beforeEach } from "vitest";

// Integration test for click/signup ingestion, with Prisma mocked.
vi.mock("./db", () => ({
  db: {
    trackedLink: { findUnique: vi.fn() },
    event: { create: vi.fn() },
  },
}));

import { db } from "./db";
import { ingestSignup, ingestClick } from "./attribution";

const mockDb = db as unknown as {
  trackedLink: { findUnique: ReturnType<typeof vi.fn> };
  event: { create: ReturnType<typeof vi.fn> };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ingestSignup", () => {
  it("logs a SIGNUP event for a known tracked link", async () => {
    mockDb.trackedLink.findUnique.mockResolvedValue({ id: "link1" });
    mockDb.event.create.mockResolvedValue({});

    const ok = await ingestSignup("code123", { via: "pixel" });

    expect(ok).toBe(true);
    expect(mockDb.event.create).toHaveBeenCalledTimes(1);
    expect(mockDb.event.create.mock.calls[0][0].data).toMatchObject({
      trackedLinkId: "link1",
      type: "SIGNUP",
      meta: { via: "pixel" },
    });
  });

  it("no-ops for an unknown code (returns false, writes nothing)", async () => {
    mockDb.trackedLink.findUnique.mockResolvedValue(null);
    const ok = await ingestSignup("nope");
    expect(ok).toBe(false);
    expect(mockDb.event.create).not.toHaveBeenCalled();
  });
});

describe("ingestClick", () => {
  it("logs a CLICK and returns the destination with lw_ref appended", async () => {
    mockDb.trackedLink.findUnique.mockResolvedValue({
      id: "link1",
      destUrl: "https://hookline.dev/?utm_source=hn",
    });
    mockDb.event.create.mockResolvedValue({});

    const dest = await ingestClick("code123");

    expect(mockDb.event.create).toHaveBeenCalledTimes(1);
    expect(mockDb.event.create.mock.calls[0][0].data).toMatchObject({
      trackedLinkId: "link1",
      type: "CLICK",
    });
    expect(dest).toContain("lw_ref=code123");
  });

  it("redirects without recording when record:false (rate limited)", async () => {
    mockDb.trackedLink.findUnique.mockResolvedValue({
      id: "link1",
      destUrl: "https://hookline.dev/",
    });
    const dest = await ingestClick("code123", { record: false });
    expect(mockDb.event.create).not.toHaveBeenCalled();
    expect(dest).toContain("lw_ref=code123");
  });

  it("refuses to redirect to an unsafe destination", async () => {
    mockDb.trackedLink.findUnique.mockResolvedValue({
      id: "link1",
      destUrl: "javascript:alert(1)",
    });
    const dest = await ingestClick("code123");
    expect(dest).toBeNull();
    expect(mockDb.event.create).not.toHaveBeenCalled();
  });
});
