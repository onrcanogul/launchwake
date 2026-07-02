import { describe, it, expect } from "vitest";
import {
  scoreIntent,
  excerptOf,
  parseHnIntent,
  parseRedditIntent,
  rankIntent,
  searchTerms,
  type IntentCandidate,
} from "./intentRadar";

const NOW = new Date("2026-07-02T12:00:00Z");
const query = {
  phrases: ["is there a tool that", "alternative to segment"],
  keywords: ["attribution", "signups", "channel"],
};

const cand = (over: Partial<IntentCandidate>): IntentCandidate => ({
  source: "REDDIT",
  externalId: "t3_x",
  title: "",
  url: "https://reddit.com/x",
  author: "u/x",
  text: "",
  at: new Date("2026-07-02T10:00:00Z"),
  ...over,
});

describe("scoreIntent", () => {
  it("scores high when a user phrase + topic keyword + question line up", () => {
    const r = scoreIntent(
      cand({ title: "Is there a tool that tracks which channel drove signups?" }),
      query,
      NOW,
    );
    expect(r).not.toBeNull();
    expect(r!.score).toBeGreaterThanOrEqual(60);
    expect(r!.reason).toMatch(/intent phrase/);
  });

  it("returns null when the topic keyword is absent (off-topic)", () => {
    expect(
      scoreIntent(cand({ title: "Is there a tool that resizes my images?" }), query, NOW),
    ).toBeNull();
  });

  it("returns null on a topical mention with no expressed intent", () => {
    expect(
      scoreIntent(cand({ title: "Our attribution numbers looked great this quarter." }), query, NOW),
    ).toBeNull();
  });

  it("penalizes self-promotion so a launch post doesn't read as a lead", () => {
    const r = scoreIntent(
      cand({ title: "I built an attribution tool that tracks signups by channel — check out my launch" }),
      query,
      NOW,
    );
    // Promo penalty should drop it below the surfacing threshold.
    expect(r).toBeNull();
  });

  it("rewards recency", () => {
    const fresh = scoreIntent(
      cand({ title: "Looking for an attribution tool for signups", at: new Date("2026-07-02T09:00:00Z") }),
      query,
      NOW,
    )!;
    const stale = scoreIntent(
      cand({ title: "Looking for an attribution tool for signups", at: new Date("2026-06-01T09:00:00Z") }),
      query,
      NOW,
    )!;
    expect(fresh.score).toBeGreaterThan(stale.score);
  });
});

describe("parseHnIntent", () => {
  it("maps a comment hit to a candidate pointing at the item", () => {
    const items = parseHnIntent({
      hits: [
        {
          objectID: "999",
          comment_text: "Is there a tool that does channel attribution for signups?",
          story_title: "Ask HN: growth tooling",
          author: "pg",
          created_at: "2026-07-02T08:00:00Z",
        },
      ],
    });
    expect(items).toHaveLength(1);
    expect(items[0].source).toBe("HN");
    expect(items[0].externalId).toBe("hn_999");
    expect(items[0].url).toBe("https://news.ycombinator.com/item?id=999");
    expect(items[0].title).toContain("Comment on");
  });

  it("skips hits with no usable text", () => {
    expect(parseHnIntent({ hits: [{ objectID: "1", created_at: "2026-07-02T08:00:00Z" }] })).toHaveLength(0);
  });
});

describe("parseRedditIntent", () => {
  it("maps a listing child to a candidate with the fullname as externalId", () => {
    const items = parseRedditIntent({
      data: {
        children: [
          {
            data: {
              name: "t3_abc",
              title: "Alternative to Segment for attribution?",
              selftext: "need to track signups by channel",
              permalink: "/r/SaaS/comments/abc/x/",
              author: "founder",
              created_utc: 1751450400,
            },
          },
        ],
      },
    });
    expect(items).toHaveLength(1);
    expect(items[0].externalId).toBe("t3_abc");
    expect(items[0].url).toBe("https://www.reddit.com/r/SaaS/comments/abc/x/");
  });

  it("drops stickied posts", () => {
    const items = parseRedditIntent({
      data: { children: [{ data: { name: "t3_s", title: "rules", permalink: "/x", stickied: true } }] },
    });
    expect(items).toHaveLength(0);
  });
});

describe("rankIntent", () => {
  it("gates, dedupes by externalId keeping the best score, and sorts desc", () => {
    const dupLow = cand({ externalId: "dup", title: "attribution tool?", text: "channel" });
    const dupHigh = cand({
      externalId: "dup",
      title: "Is there a tool that tracks which channel drove signups?",
    });
    const offTopic = cand({ externalId: "off", title: "is there a tool to edit photos?" });
    const ranked = rankIntent([offTopic, dupLow, dupHigh], query, NOW);
    expect(ranked.map((r) => r.candidate.externalId)).toEqual(["dup"]);
  });
});

describe("searchTerms", () => {
  it("dedupes and drops too-short terms", () => {
    const terms = searchTerms({ phrases: ["is there a tool", "hi"], keywords: ["attribution", "attribution"] });
    expect(terms).toContain("is there a tool");
    expect(terms).toContain("attribution");
    expect(terms).not.toContain("hi");
    expect(new Set(terms).size).toBe(terms.length);
  });
});

describe("excerptOf", () => {
  it("truncates long text with an ellipsis", () => {
    expect(excerptOf("a".repeat(300), 50)).toHaveLength(50);
    expect(excerptOf("short")).toBe("short");
  });
});
