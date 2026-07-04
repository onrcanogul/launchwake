import { describe, it, expect, vi } from "vitest";
import {
  safeFetchPublicUrl,
  SafeFetchError,
  type ResolvedAddress,
} from "./safeFetch";

/** DNS mock: hostname → addresses. Unknown hosts "fail to resolve". */
function makeLookup(map: Record<string, ResolvedAddress[]>) {
  return async (hostname: string): Promise<ResolvedAddress[]> => map[hostname] ?? [];
}

/** A streaming Response with no Content-Length (forces the streamed size cap). */
function streamResponse(
  bytes: Uint8Array,
  init: { status?: number; headers?: Record<string, string> } = {},
) {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
  return new Response(stream, {
    status: init.status ?? 200,
    headers: init.headers,
  });
}

const PUBLIC = [{ address: "93.184.216.34", family: 4 }];

describe("safeFetchPublicUrl", () => {
  it("rejects a non-http(s) scheme before doing any DNS or fetch", async () => {
    const fetchImpl = vi.fn();
    await expect(
      safeFetchPublicUrl("ftp://example.com/x", {
        lookup: makeLookup({}),
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toBeInstanceOf(SafeFetchError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects a host that resolves to a private address (never fetches)", async () => {
    const fetchImpl = vi.fn();
    await expect(
      safeFetchPublicUrl("http://intranet.example/", {
        lookup: makeLookup({ "intranet.example": [{ address: "10.0.0.5", family: 4 }] }),
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/private address/i);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects the cloud-metadata IP given as a literal host", async () => {
    const fetchImpl = vi.fn();
    await expect(
      safeFetchPublicUrl("http://169.254.169.254/latest/meta-data/", {
        lookup: makeLookup({}),
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toBeInstanceOf(SafeFetchError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("re-validates each redirect hop and rejects a redirect to a private host", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.startsWith("http://public.example")) {
        return new Response(null, {
          status: 302,
          headers: { location: "http://internal.example/admin" },
        });
      }
      throw new Error("must not fetch the private host");
    });
    await expect(
      safeFetchPublicUrl("http://public.example/", {
        lookup: makeLookup({
          "public.example": PUBLIC,
          "internal.example": [{ address: "127.0.0.1", family: 4 }],
        }),
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/private address/i);
    // The first hop was fetched; the private second hop was blocked pre-fetch.
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("aborts a response body over the size cap", async () => {
    const fetchImpl = vi.fn(async () => streamResponse(new Uint8Array(50)));
    await expect(
      safeFetchPublicUrl("http://public.example/big", {
        maxBytes: 10,
        lookup: makeLookup({ "public.example": PUBLIC }),
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/exceeded|too large/i);
  });

  it("rejects when Content-Length already declares an oversize body", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response("small", {
          status: 200,
          headers: { "content-length": "9999999" },
        }),
    );
    await expect(
      safeFetchPublicUrl("http://public.example/", {
        maxBytes: 1000,
        lookup: makeLookup({ "public.example": PUBLIC }),
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/too large/i);
  });

  it("passes the happy path and sends the fixed user-agent", async () => {
    let captured: RequestInit | undefined;
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      captured = init;
      return streamResponse(new TextEncoder().encode("<html>ok</html>"));
    });
    const res = await safeFetchPublicUrl("http://public.example/page", {
      lookup: makeLookup({ "public.example": PUBLIC }),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(res.status).toBe(200);
    expect(res.text()).toContain("ok");

    const headers = captured!.headers as Record<string, string>;
    expect(headers["user-agent"]).toBe("LaunchWakeBot/1.0");
    expect(captured!.redirect).toBe("manual");
  });

  it("follows a redirect to another public host, then succeeds", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.startsWith("http://a.example")) {
        return new Response(null, {
          status: 301,
          headers: { location: "https://b.example/final" },
        });
      }
      return streamResponse(new TextEncoder().encode("done"));
    });
    const res = await safeFetchPublicUrl("http://a.example/", {
      lookup: makeLookup({ "a.example": PUBLIC, "b.example": PUBLIC }),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(res.status).toBe(200);
    expect(res.url).toBe("https://b.example/final");
    expect(res.text()).toBe("done");
  });

  it("gives up after too many redirects", async () => {
    // Always redirects onward → exceeds the default max of 3.
    const fetchImpl = vi.fn(async (url: string) => {
      const n = Number(new URL(url).searchParams.get("n") ?? "0");
      return new Response(null, {
        status: 302,
        headers: { location: `http://loop.example/?n=${n + 1}` },
      });
    });
    await expect(
      safeFetchPublicUrl("http://loop.example/?n=0", {
        lookup: makeLookup({ "loop.example": PUBLIC }),
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/too many redirects/i);
  });
});
