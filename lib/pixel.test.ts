import { describe, expect, it } from "vitest";
import {
  buildPixelJs,
  isValidProjectId,
  pixelHtmlSnippet,
  pixelNextjsSnippet,
  pixelScriptTag,
  pixelSrc,
  PIXEL_PING_THROTTLE_MS,
} from "./pixel";

const APP = "https://www.launchwake.com";
const PID = "clxyz1234567890abcdefgh";

describe("isValidProjectId", () => {
  it("accepts cuid-shaped ids", () => {
    expect(isValidProjectId(PID)).toBe(true);
  });

  it("rejects anything that could break out of the served JS", () => {
    expect(isValidProjectId("")).toBe(false);
    expect(isValidProjectId("short")).toBe(false);
    expect(isValidProjectId("UPPERCASEUPPERCASEUPPER")).toBe(false);
    expect(isValidProjectId(`abc'); alert(1); ('`)).toBe(false);
    expect(isValidProjectId("../../etc/passwd-aaaaaaaa")).toBe(false);
  });
});

describe("snippet builders", () => {
  it("builds the one-liner script tag", () => {
    expect(pixelScriptTag(APP, PID)).toBe(
      `<script async src="${APP}/api/pixel/${PID}"></script>`,
    );
  });

  it("tolerates a trailing slash on the app url", () => {
    expect(pixelSrc(`${APP}/`, PID)).toBe(`${APP}/api/pixel/${PID}`);
  });

  it("embeds the script url in the framework snippets", () => {
    expect(pixelNextjsSnippet(APP, PID)).toContain(`src="${APP}/api/pixel/${PID}"`);
    expect(pixelNextjsSnippet(APP, PID)).toContain(`import Script from "next/script"`);
    expect(pixelHtmlSnippet(APP, PID)).toContain(pixelScriptTag(APP, PID));
  });
});

describe("buildPixelJs", () => {
  const js = buildPixelJs(APP, PID);

  it("captures lw_ref and defines launchwakeSignup", () => {
    expect(js).toContain("get('lw_ref')");
    expect(js).toContain("localStorage.setItem('lw_ref', ref)");
    expect(js).toContain("window.launchwakeSignup = function ()");
    expect(js).toContain("'/api/track/signup'");
  });

  it("sends a throttled verification ping with the project id", () => {
    expect(js).toContain("'/api/track/verify'");
    expect(js).toContain(JSON.stringify(PID));
    expect(js).toContain(String(PIXEL_PING_THROTTLE_MS));
  });

  it("embeds the base url without a trailing slash", () => {
    expect(js).toContain(`var BASE = "${APP}";`);
    expect(buildPixelJs(`${APP}/`, PID)).toContain(`var BASE = "${APP}";`);
  });

  it("never touches host-page cookies or DOM", () => {
    expect(js).not.toContain("document.cookie");
    expect(js).not.toContain("appendChild");
    expect(js).not.toContain("innerHTML");
  });
});
