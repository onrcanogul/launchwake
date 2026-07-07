import { describe, it, expect, beforeEach, vi } from "vitest";

// redirect() never returns — it throws so the caller unwinds. Model that with a
// sentinel carrying the target so each test can assert *where* we bounced to.
const { authMock, findUniqueMock, RedirectError } = vi.hoisted(() => {
  class RedirectError extends Error {
    constructor(public url: string) {
      super(`redirect:${url}`);
    }
  }
  return { authMock: vi.fn(), findUniqueMock: vi.fn(), RedirectError };
});

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new RedirectError(url);
  },
  notFound: () => {
    throw new Error("not-found");
  },
}));
vi.mock("./auth", () => ({ auth: authMock }));
vi.mock("./db", () => ({ db: { user: { findUnique: findUniqueMock } } }));
// Siblings requireSessionUser never touches — stubbed so their next/headers
// (cookies) imports don't load in the unit test.
vi.mock("./activeShip", () => ({ readActiveShipId: vi.fn() }));
vi.mock("./ships", () => ({ listProjectShips: vi.fn() }));
vi.mock("./projects", () => ({ listAccountProjects: vi.fn() }));
vi.mock("./team", () => ({ resolveAccount: vi.fn() }));

import { requireSessionUser } from "./session";

async function redirectTarget(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    if (e instanceof RedirectError) return e.url;
    throw e;
  }
  throw new Error("expected a redirect, but the call resolved");
}

describe("requireSessionUser", () => {
  beforeEach(() => {
    authMock.mockReset();
    findUniqueMock.mockReset();
  });

  it("redirects to /login when there is no session (never touches the DB)", async () => {
    authMock.mockResolvedValue(null);
    expect(await redirectTarget(requireSessionUser())).toBe("/login");
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it("redirects a ghost session — valid JWT, deleted user — to /reauth so the stale cookie gets cleared", async () => {
    authMock.mockResolvedValue({ user: { id: "gone_1" } });
    findUniqueMock.mockResolvedValue(null);
    expect(await redirectTarget(requireSessionUser())).toBe("/reauth");
  });

  it("returns the DB user when the session maps to a live record", async () => {
    const user = { id: "u_1", email: "a@b.co", plan: "FREE" };
    authMock.mockResolvedValue({ user: { id: "u_1" } });
    findUniqueMock.mockResolvedValue(user);
    await expect(requireSessionUser()).resolves.toBe(user);
  });
});
