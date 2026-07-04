import { describe, it, expect } from "vitest";
import { isSafeHttpUrl, normalizeHttpUrl } from "./url";

describe("isSafeHttpUrl", () => {
  it("accepts real http(s) URLs", () => {
    expect(isSafeHttpUrl("https://hookline.dev")).toBe(true);
    expect(isSafeHttpUrl("http://localhost:3000/thanks")).toBe(true);
    expect(isSafeHttpUrl("https://x.io/a?b=c#d")).toBe(true);
  });

  it("rejects dangerous schemes (the XSS / open-redirect vectors)", () => {
    expect(isSafeHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeHttpUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
    expect(isSafeHttpUrl("file:///etc/passwd")).toBe(false);
    expect(isSafeHttpUrl("vbscript:msgbox(1)")).toBe(false);
  });

  it("rejects non-URLs and schemes without a host", () => {
    expect(isSafeHttpUrl("not a url")).toBe(false);
    expect(isSafeHttpUrl("/relative/path")).toBe(false);
    expect(isSafeHttpUrl("")).toBe(false);
    expect(isSafeHttpUrl("http:")).toBe(false);
    expect(isSafeHttpUrl("mailto:x@y.com")).toBe(false);
  });
});

describe("normalizeHttpUrl", () => {
  it("prepends https:// to a bare domain (the onboarding-friction case)", () => {
    expect(normalizeHttpUrl("myapp.com")).toBe("https://myapp.com");
    expect(normalizeHttpUrl("www.myapp.com")).toBe("https://www.myapp.com");
  });

  it("keeps path, query and hash on a bare domain", () => {
    expect(normalizeHttpUrl("www.myapp.com/x")).toBe("https://www.myapp.com/x");
    expect(normalizeHttpUrl("myapp.com/a?b=c#d")).toBe("https://myapp.com/a?b=c#d");
  });

  it("passes through an existing http(s) scheme, canonicalizing the root slash", () => {
    expect(normalizeHttpUrl("https://myapp.com")).toBe("https://myapp.com");
    expect(normalizeHttpUrl("https://myapp.com/")).toBe("https://myapp.com");
    expect(normalizeHttpUrl("http://myapp.com/path")).toBe("http://myapp.com/path");
  });

  it("trims surrounding whitespace before normalizing", () => {
    expect(normalizeHttpUrl("  myapp.com  ")).toBe("https://myapp.com");
  });

  it("rejects the javascript: XSS scheme", () => {
    expect(normalizeHttpUrl("javascript:alert(1)")).toBeNull();
  });

  it("rejects non-http(s) schemes (ftp:, mailto:, data:)", () => {
    expect(normalizeHttpUrl("ftp://files.myapp.com")).toBeNull();
    expect(normalizeHttpUrl("mailto:me@myapp.com")).toBeNull();
    expect(normalizeHttpUrl("data:text/html,<script>")).toBeNull();
  });

  it("rejects garbage, empty input and single-label hosts", () => {
    expect(normalizeHttpUrl("not a url")).toBeNull();
    expect(normalizeHttpUrl("")).toBeNull();
    expect(normalizeHttpUrl("   ")).toBeNull();
    expect(normalizeHttpUrl("localhost")).toBeNull();
  });

  it("rejects a URL that exceeds the length cap post-normalization", () => {
    const under = "myapp.com/" + "a".repeat(480); // < 500 once https:// prepended
    expect(normalizeHttpUrl(under)).not.toBeNull();
    const over = "myapp.com/" + "a".repeat(600);
    expect(normalizeHttpUrl(over)).toBeNull();
  });
});
