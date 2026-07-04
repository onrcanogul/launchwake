import { describe, it, expect } from "vitest";
import { sanitizeAccent, sanitizeLogoUrl, brandView, LAUNCHWAKE_ACCENT } from "./clientReport";

describe("sanitizeAccent", () => {
  it("normalizes valid hex (with or without #) to lowercase #rrggbb", () => {
    expect(sanitizeAccent("#3ECFB6")).toBe("#3ecfb6");
    expect(sanitizeAccent("ff8800")).toBe("#ff8800");
  });
  it("rejects anything that isn't a 6-digit hex", () => {
    expect(sanitizeAccent("red")).toBeNull();
    expect(sanitizeAccent("#fff")).toBeNull();
    expect(sanitizeAccent("#1234567")).toBeNull(); // too long
    expect(sanitizeAccent("#12g456")).toBeNull(); // non-hex char
    expect(sanitizeAccent("")).toBeNull();
    expect(sanitizeAccent(null)).toBeNull();
  });
});

describe("sanitizeLogoUrl", () => {
  it("allows https URLs (only)", () => {
    expect(sanitizeLogoUrl("https://acme.com/logo.png")).toBe("https://acme.com/logo.png");
  });
  it("rejects injection vectors and non-https schemes", () => {
    expect(sanitizeLogoUrl("javascript:alert(1)")).toBeNull();
    expect(sanitizeLogoUrl("http://acme.com/logo.png")).toBeNull();
    expect(sanitizeLogoUrl('https://x.com/a" onerror="alert(1)')).toBeNull();
    expect(sanitizeLogoUrl(null)).toBeNull();
  });
  it("rejects data: URLs entirely (https-only, no inline images)", () => {
    expect(sanitizeLogoUrl("data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==")).toBeNull();
    expect(sanitizeLogoUrl("data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=")).toBeNull();
    expect(sanitizeLogoUrl("data:text/html;base64,PHNjcmlwdD4=")).toBeNull();
  });
  it("enforces the length cap", () => {
    const tooLong = "https://acme.com/" + "a".repeat(2000);
    expect(tooLong.length).toBeGreaterThan(2000);
    expect(sanitizeLogoUrl(tooLong)).toBeNull();
  });
});

describe("brandView", () => {
  it("returns null when there's no brand", () => {
    expect(brandView(null)).toBeNull();
  });
  it("validates the accent and drops an unsafe logo, defaulting the accent", () => {
    const v = brandView({ agencyName: "Acme Growth", logoUrl: "javascript:bad", accentColor: "bad" })!;
    expect(v.agencyName).toBe("Acme Growth");
    expect(v.logoUrl).toBeNull();
    expect(v.accentColor).toBe(LAUNCHWAKE_ACCENT);
  });
  it("keeps a valid logo + accent", () => {
    const v = brandView({ agencyName: "Acme", logoUrl: "https://acme.com/l.png", accentColor: "#112233" })!;
    expect(v.logoUrl).toBe("https://acme.com/l.png");
    expect(v.accentColor).toBe("#112233");
  });
});
