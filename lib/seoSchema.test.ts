import { describe, it, expect } from "vitest";
import { faqPageJsonLd, breadcrumbJsonLd, itemListJsonLd } from "./seoSchema";

describe("faqPageJsonLd", () => {
  it("builds a valid FAQPage with one Question per item", () => {
    const ld = faqPageJsonLd([
      { question: "Can I post?", answer: "Yes, with rules." },
      { question: "When?", answer: "Tue 8am ET." },
    ]);
    expect(ld["@type"]).toBe("FAQPage");
    const entities = ld.mainEntity as Array<Record<string, unknown>>;
    expect(entities).toHaveLength(2);
    expect(entities[0]["@type"]).toBe("Question");
    expect(entities[0].name).toBe("Can I post?");
    expect(
      (entities[0].acceptedAnswer as Record<string, unknown>).text,
    ).toBe("Yes, with rules.");
  });

  it("serializes to JSON cleanly", () => {
    expect(() =>
      JSON.stringify(faqPageJsonLd([{ question: "q", answer: "a" }])),
    ).not.toThrow();
  });
});

describe("breadcrumbJsonLd", () => {
  it("assigns 1-based positions in order", () => {
    const ld = breadcrumbJsonLd([
      { name: "Channels", url: "https://x.com/channels" },
      { name: "r/SaaS", url: "https://x.com/channels/r-saas" },
    ]);
    const items = ld.itemListElement as Array<Record<string, unknown>>;
    expect(items[0].position).toBe(1);
    expect(items[1].position).toBe(2);
    expect(items[1].item).toBe("https://x.com/channels/r-saas");
  });
});

describe("itemListJsonLd", () => {
  it("builds an ItemList with ranked positions", () => {
    const ld = itemListJsonLd([
      { name: "Show HN", url: "https://x.com/channels/hn-show" },
      { name: "Product Hunt", url: "https://x.com/channels/product-hunt" },
    ]);
    expect(ld["@type"]).toBe("ItemList");
    const items = ld.itemListElement as Array<Record<string, unknown>>;
    expect(items).toHaveLength(2);
    expect(items[0].position).toBe(1);
    expect(items[0].name).toBe("Show HN");
  });
});
