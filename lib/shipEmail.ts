import { emailFooter } from "./emailPrefs";
import type { BanRisk } from "@prisma/client";

/**
 * The GitHub-release return loop: when a webhook auto-detects a release and
 * the plan is built, this email brings the founder back — "you shipped, here's
 * where to take it". Pure builders (unit-tested); lib/jobs.ts sends them.
 */

export type PlanReadyChannel = {
  name: string;
  fitScore: number;
  banRisk: BanRisk;
};

export type ShipEmail = { subject: string; text: string };

function risk(banRisk: BanRisk): string {
  return banRisk.toLowerCase();
}

/** "Your distribution plan is ready" — sent after a webhook release → plan. */
export function buildPlanReadyEmail(input: {
  projectName: string;
  shipTitle: string;
  shipId: string;
  appUrl: string;
  channels: PlanReadyChannel[];
  unsubscribeUrl: string;
}): ShipEmail {
  const base = input.appUrl.replace(/\/$/, "");
  const top = input.channels.slice(0, 3);

  const lines = [
    `You published "${input.shipTitle}" — LaunchWake picked up the release and built its distribution plan.`,
    "",
    `WHERE TO TAKE IT${top.length > 0 ? ` — top ${top.length} of your ranked channels` : ""}`,
    ...top.map(
      (c, i) => `  ${i + 1}. ${c.name} — fit ${c.fitScore}/100 · ${risk(c.banRisk)} ban risk`,
    ),
    "",
    "Each channel comes with the rules, the safe way in, and a platform-native draft.",
    "You post it yourself — LaunchWake never posts for you.",
    "",
    `Open the plan → ${base}/app/ships/${input.shipId}/plan`,
    "",
    emailFooter(input.unsubscribeUrl),
  ];

  return {
    subject: `Your distribution plan is ready — "${input.shipTitle}"`,
    text: lines.join("\n"),
  };
}

/** Release detected but the Free plan/month limit is hit — nudge, don't ghost. */
export function buildPlanLimitEmail(input: {
  projectName: string;
  shipTitle: string;
  appUrl: string;
  unsubscribeUrl: string;
}): ShipEmail {
  const base = input.appUrl.replace(/\/$/, "");
  const lines = [
    `You published "${input.shipTitle}" — LaunchWake picked up the release, but you've used both Free distribution plans this month, so no plan was generated.`,
    "",
    "The ship is saved in your feed. Upgrade to Pro for unlimited plans, or",
    "distribute it next month — shipped work deserves an audience either way.",
    "",
    `See your ships → ${base}/app`,
    `Upgrade → ${base}/app/settings`,
    "",
    emailFooter(input.unsubscribeUrl),
  ];

  return {
    subject: `"${input.shipTitle}" shipped — plan limit reached`,
    text: lines.join("\n"),
  };
}
