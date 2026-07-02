import { describe, it, expect } from "vitest";
import { buildPitchPrompt, heuristicPitch, type PitchContext } from "./pitch";

const ctx: PitchContext = {
  project: { name: "Hookline", description: "Webhook testing and debugging for developers.", url: "https://hookline.dev" },
  ship: { type: "LAUNCH", title: "Replay any webhook to localhost", summary: "Capture, inspect and re-fire inbound webhooks." },
  channel: {
    name: "Console.dev",
    audienceDesc: "~30k developers · weekly devtools reviews",
    rules: "Reviews 2-3 developer tools each week; submit via the tool form. Must be built for developers with self-service signup.",
    url: "https://console.dev/",
  },
};

describe("buildPitchPrompt", () => {
  it("grounds the pitch in the newsletter's audience and selection criteria", () => {
    const { system, prompt } = buildPitchPrompt(ctx);
    expect(prompt).toContain("Console.dev");
    expect(prompt).toContain("~30k developers");
    expect(prompt).toContain("self-service signup"); // the newsletter's rules
    expect(prompt).toContain("Hookline");
    expect(prompt).toContain("Replay any webhook to localhost");
    // The founder sends it — never auto-send.
    expect(system).toMatch(/SEND it themselves/);
    expect(system).toMatch(/JSON object/);
  });

  it("asks for a newsworthy angle when the newsletter is editorial-only", () => {
    const { system } = buildPitchPrompt(ctx);
    expect(system).toMatch(/editorial-only/);
  });
});

describe("heuristicPitch", () => {
  it("produces a usable subject + body without an LLM", () => {
    const p = heuristicPitch(ctx);
    expect(p.subject).toContain("Hookline");
    expect(p.body).toContain("Hookline");
    expect(p.body).toContain("Console.dev");
    expect(p.body.length).toBeGreaterThan(40);
  });
});
