/**
 * Transactional emails for the automated growth loop: when the GitHub webhook
 * auto-detects a release and we build its plan, tell the founder it's ready (or,
 * if they're at their Free-plan limit, nudge an upgrade). Pure builders → the
 * copy is unit-tested; lib/notify does the sending.
 */

export type ShipEmail = { subject: string; text: string };

/** Plan page URL for a ship (trailing-slash-safe). */
export function planUrl(appUrl: string, shipId: string): string {
  return `${appUrl.replace(/\/$/, "")}/app/ships/${shipId}/plan`;
}

/** Settings/upgrade URL (trailing-slash-safe). */
export function settingsUrl(appUrl: string): string {
  return `${appUrl.replace(/\/$/, "")}/app/settings`;
}

/**
 * "vX.Y shipped — your plan is ready". `shipTitle` is the release name, which
 * for a GitHub release is the version.
 */
export function buildPlanReadyEmail(input: {
  shipTitle: string;
  projectName: string;
  url: string;
}): ShipEmail {
  const subject = `${input.shipTitle} shipped — your distribution plan is ready`;
  const text = [
    `${input.shipTitle} just shipped for ${input.projectName}, and LaunchWake built your distribution plan automatically.`,
    ``,
    `It ranks where to post this release — fit, ban risk, the safe way in, and the best time — so you can start distributing in minutes.`,
    ``,
    `See your plan: ${input.url}`,
    ``,
    `You post it yourself — LaunchWake never posts on your behalf.`,
  ].join("\n");
  return { subject, text };
}

/**
 * "vX.Y shipped — you're at your Free plan limit". Sent instead of the ready
 * email when auto-building would exceed the monthly Free-plan quota; the ship
 * still lands in the feed, so nothing is lost.
 */
export function buildPlanLimitEmail(input: {
  shipTitle: string;
  projectName: string;
  used: number;
  limit: number;
  upgradeUrl: string;
}): ShipEmail {
  const subject = `${input.shipTitle} shipped — you're at your Free plan limit`;
  const text = [
    `${input.shipTitle} just shipped for ${input.projectName}, and we detected it automatically.`,
    ``,
    `You've used ${input.used}/${input.limit} distribution plans on the Free plan this month, so we didn't auto-build this one. Upgrade to Pro for unlimited plans and your plan will be ready instantly on every ship.`,
    ``,
    `Upgrade: ${input.upgradeUrl}`,
    ``,
    `The ship is still in your feed — you can build its plan any time.`,
  ].join("\n");
  return { subject, text };
}
