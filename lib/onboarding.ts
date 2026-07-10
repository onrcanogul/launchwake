/**
 * Onboarding "connect your product" branch — a pure decision kept out of the RSC
 * page so it's unit-testable. Three first-run experiences:
 *
 *  - "picker"       — a GitHub App installation exists and its repos loaded, so
 *                     show the repo picker (private repos included).
 *  - "connect"      — the user signed in with GitHub but hasn't installed the App
 *                     yet: lead with the read-only "Connect GitHub" install CTA,
 *                     with manual entry as the fallback.
 *  - "manual-first" — an email / magic-link user with no GitHub account linked:
 *                     skip the picker entirely and go straight to manual product
 *                     entry. GitHub is offered as an optional card (only when the
 *                     App is configured — they can still install it if they want).
 *
 * The wizard always completes without GitHub; this only decides what leads.
 */
export type OnboardingConnectMode = "picker" | "connect" | "manual-first";

export function onboardingConnectMode(input: {
  /** The GitHub App is configured on this deployment (an install URL exists). */
  appConfigured: boolean;
  /** A stored / cookie-bridged installation id, or null when none. */
  installationId: string | null;
  /** Listing the installation's repos failed — treat as not usable. */
  reposError: boolean;
  /** The signed-in user has a linked GitHub OAuth account. */
  githubLinked: boolean;
}): OnboardingConnectMode {
  const installed = input.installationId !== null && !input.reposError;
  if (installed) return "picker";
  // No usable installation. Only lead with the GitHub install CTA when the App is
  // configured AND the user actually came in through GitHub; everyone else
  // (email / magic-link users, or no App at all) starts with manual entry.
  if (input.appConfigured && input.githubLinked) return "connect";
  return "manual-first";
}
