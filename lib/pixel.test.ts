import { describe, expect, it } from "vitest";
import {
  buildPixelJs,
  isValidProjectId,
  pixelHtmlSnippet,
  pixelNextjsSnippet,
  pixelScriptTag,
  pixelSrc,
  PIXEL_PING_THROTTLE_MS,
  surveyDropInSnippet,
  surveyOptionsHtml,
  surveyReactSnippet,
  surveyPromptSnippet,
  surveyCallSnippet,
} from "./pixel";
import { SELF_REPORT_OPTIONS } from "./selfReport";

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
    expect(js).toContain("window.launchwakeSignup = function (email)");
    expect(js).toContain("'/api/track/signup'");
  });

  it("defines launchwakeSurvey that beacons the answer + stored ref to /api/track/survey", () => {
    expect(js).toContain("window.launchwakeSurvey = function (answer)");
    expect(js).toContain("'/api/track/survey'");
    expect(js).toContain("answer: String(answer)");
    // The survey must carry the project id (self-reports aren't link-scoped).
    expect(js).toContain("project: PROJECT");
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

describe("survey snippet builders", () => {
  it("renders an <option> per taxonomy source (except the free-text 'other') in the drop-in", () => {
    const opts = surveyOptionsHtml();
    for (const o of SELF_REPORT_OPTIONS) {
      if (o.value === "other") continue;
      expect(opts).toContain(`value="${o.value}"`);
      expect(opts).toContain(o.label);
    }
    expect(opts).not.toContain(`value="other"`);
  });

  it("the drop-in wires the select to window.launchwakeSurvey and adds the 'other' option", () => {
    const html = surveyDropInSnippet();
    expect(html).toContain("window.launchwakeSurvey(this.value)");
    expect(html).toContain('How did you hear about us?');
    expect(html).toContain(`value="other"`);
  });

  it("the React + prompt variants reference launchwakeSurvey and the shared options", () => {
    expect(surveyReactSnippet()).toContain("window.launchwakeSurvey");
    expect(surveyReactSnippet()).toContain('value="word_of_mouth"');
    expect(surveyPromptSnippet()).toContain("launchwakeSurvey");
    expect(surveyPromptSnippet()).toContain("dark-social");
    expect(surveyCallSnippet()).toContain("window.launchwakeSurvey");
  });
});
