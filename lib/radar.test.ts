import { describe, it, expect } from "vitest";
import {
  radarQueries,
  extractAngle,
  parseHnHits,
  parseRedditListing,
  rankRadar,
  buildRadarDigest,
  type RadarItem,
} from "./radar";

describe("radarQueries", () => {
  it("pulls concrete category terms from the product text", () => {
    const q = radarQueries("Hookdeck — a webhook and API tool for developers");
    expect(q).toContain("webhook");
    expect(q).toContain("api");
  });
  it("falls back when nothing matches", () => {
    expect(radarQueries("a lovely journal for feelings")).toEqual(["developer tools"]);
  });
});

describe("extractAngle", () => {
  it("pulls the tagline after the dash, dropping the Show HN prefix", () => {
    expect(extractAngle("Show HN: Hookdeck – Reliable webhook infrastructure")).toBe(
      "Reliable webhook infrastructure",
    );
  });
  it("returns null when there's no tagline", () => {
    expect(extractAngle("Just a plain title")).toBeNull();
  });
});

describe("parseHnHits", () => {
  it("maps Algolia hits to radar items with a discussion link", () => {
    const items = parseHnHits({
      hits: [
        {
          objectID: "42",
          title: "Show HN: Hookdeck – Reliable webhooks",
          url: "https://hookdeck.com",
          points: 180,
          num_comments: 42,
          created_at: "2026-07-01T10:00:00Z",
        },
      ],
    });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      source: "HN",
      url: "https://news.ycombinator.com/item?id=42",
      points: 180,
      comments: 42,
      angle: "Reliable webhooks",
    });
  });
});

describe("parseRedditListing", () => {
  it("maps posts, skips stickied, builds absolute urls", () => {
    const items = parseRedditListing({
      data: {
        children: [
          { data: { title: "Weekly thread", permalink: "/r/webdev/w", stickied: true } },
          {
            data: {
              title: "I built a webhook tester",
              permalink: "/r/webdev/comments/x/",
              score: 95,
              num_comments: 12,
              created_utc: 1_782_000_000,
            },
          },
        ],
      },
    });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      source: "REDDIT",
      url: "https://www.reddit.com/r/webdev/comments/x/",
      points: 95,
    });
  });
});

describe("rankRadar", () => {
  const base = (o: Partial<RadarItem>): RadarItem => ({
    source: "HN",
    title: "t",
    url: Math.random().toString(),
    points: 0,
    comments: null,
    at: new Date(0),
    angle: null,
    ...o,
  });

  it("keeps HN items, filters Reddit to category matches, sorts by points", () => {
    const items = [
      base({ source: "HN", title: "Show HN: A thing", points: 50, url: "hn1" }),
      base({ source: "REDDIT", title: "My webhook tool launch", points: 200, url: "r1" }),
      base({ source: "REDDIT", title: "Unrelated cat photos", points: 999, url: "r2" }),
    ];
    const ranked = rankRadar(items, ["webhook"], 8);
    expect(ranked.map((r) => r.url)).toEqual(["r1", "hn1"]); // cat photos dropped, sorted by points
  });

  it("dedupes near-identical titles and respects the limit", () => {
    const items = [
      base({ title: "Show HN: Dup!!", points: 10, url: "a" }),
      base({ title: "Show HN: Dup", points: 5, url: "b" }),
      base({ title: "Show HN: Other", points: 1, url: "c" }),
    ];
    const ranked = rankRadar(items, [], 2);
    expect(ranked).toHaveLength(2);
    expect(ranked.map((r) => r.url)).toEqual(["a", "c"]);
  });
});

describe("buildRadarDigest", () => {
  it("is null with no items", () => {
    expect(buildRadarDigest([], "Acme")).toBeNull();
  });
  it("lists launches with points and angle for the weekly email", () => {
    const digest = buildRadarDigest(
      [
        {
          source: "HN",
          title: "Show HN: Rival",
          url: "https://news.ycombinator.com/item?id=1",
          points: 180,
          comments: 5,
          at: new Date(0),
          angle: "the fast one",
        },
      ],
      "Acme",
    )!;
    expect(digest.subject).toContain("Acme");
    expect(digest.text).toContain("180 pts");
    expect(digest.text).toContain('angle: "the fast one"');
    expect(digest.text).toContain("news.ycombinator.com/item?id=1");
  });
});
