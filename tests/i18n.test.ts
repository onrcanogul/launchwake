import { describe, it, expect } from "vitest";
import { routing } from "../i18n/routing";
import { isLocale, localizedPath, alternatesFor } from "../i18n/paths";

describe("routing config", () => {
  it("supports English (default) and Turkish with as-needed prefixing", () => {
    expect(routing.locales).toEqual(["en", "tr"]);
    expect(routing.defaultLocale).toBe("en");
    expect(routing.localePrefix).toBe("as-needed");
  });
});

describe("isLocale", () => {
  it("accepts supported locales and rejects everything else", () => {
    expect(isLocale("en")).toBe(true);
    expect(isLocale("tr")).toBe(true);
    expect(isLocale("de")).toBe(false);
    expect(isLocale("")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
    expect(isLocale(null)).toBe(false);
  });
});

describe("localizedPath", () => {
  it("keeps default-locale URLs bare (as-needed)", () => {
    expect(localizedPath("", "en")).toBe("/");
    expect(localizedPath("/", "en")).toBe("/");
    expect(localizedPath("/pricing", "en")).toBe("/pricing");
    expect(localizedPath("/channels/reddit-saas", "en")).toBe(
      "/channels/reddit-saas",
    );
  });

  it("prefixes non-default locales", () => {
    expect(localizedPath("", "tr")).toBe("/tr");
    expect(localizedPath("/", "tr")).toBe("/tr");
    expect(localizedPath("/pricing", "tr")).toBe("/tr/pricing");
    expect(localizedPath("/channels/reddit-saas", "tr")).toBe(
      "/tr/channels/reddit-saas",
    );
  });
});

describe("alternatesFor", () => {
  it("points canonical at the current locale", () => {
    expect(alternatesFor("/pricing", "en").canonical).toBe("/pricing");
    expect(alternatesFor("/pricing", "tr").canonical).toBe("/tr/pricing");
  });

  it("emits an hreflang entry per locale plus x-default → default locale", () => {
    const { languages } = alternatesFor("/pricing", "tr");
    expect(languages).toEqual({
      en: "/pricing",
      tr: "/tr/pricing",
      "x-default": "/pricing",
    });
  });

  it("handles the landing page (empty clean path)", () => {
    const { canonical, languages } = alternatesFor("", "en");
    expect(canonical).toBe("/");
    expect(languages).toEqual({
      en: "/",
      tr: "/tr",
      "x-default": "/",
    });
  });
});
