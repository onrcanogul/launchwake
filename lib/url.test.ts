import { describe, it, expect } from "vitest";
import { isSafeHttpUrl } from "./url";

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
