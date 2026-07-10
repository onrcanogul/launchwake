import { describe, it, expect } from "vitest";
import { onboardingConnectMode } from "./onboarding";

describe("onboardingConnectMode", () => {
  // A GitHub-authed user on a deployment with the App configured, no install yet.
  const base = {
    appConfigured: true,
    installationId: null as string | null,
    reposError: false,
    githubLinked: true,
  };

  it("shows the repo picker once an installation's repos have loaded", () => {
    expect(onboardingConnectMode({ ...base, installationId: "42" })).toBe(
      "picker",
    );
  });

  it("does not show the picker when the repo listing failed", () => {
    // GitHub user → back to the install CTA (which doubles as reconnect)…
    expect(
      onboardingConnectMode({
        ...base,
        installationId: "42",
        reposError: true,
      }),
    ).toBe("connect");
    // …email user → manual entry with GitHub optional.
    expect(
      onboardingConnectMode({
        ...base,
        installationId: "42",
        reposError: true,
        githubLinked: false,
      }),
    ).toBe("manual-first");
  });

  it("leads GitHub users with the install CTA when the App is configured but not installed", () => {
    expect(onboardingConnectMode(base)).toBe("connect");
  });

  it("sends email / magic-link users (no GitHub linked) straight to manual entry", () => {
    expect(onboardingConnectMode({ ...base, githubLinked: false })).toBe(
      "manual-first",
    );
  });

  it("falls back to manual when the App isn't configured — even for GitHub users", () => {
    expect(onboardingConnectMode({ ...base, appConfigured: false })).toBe(
      "manual-first",
    );
  });

  it("picker wins whenever an installation is usable, regardless of link/App flags", () => {
    expect(
      onboardingConnectMode({
        appConfigured: false,
        installationId: "7",
        reposError: false,
        githubLinked: false,
      }),
    ).toBe("picker");
  });
});
