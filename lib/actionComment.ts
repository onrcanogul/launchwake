/**
 * The comment the GitHub Action posts on a release/PR: "distribution plan ready".
 * Pure → unit-testable. The hidden marker lets the Action find & update its own
 * comment instead of duplicating.
 */

export const PLAN_COMMENT_MARKER = "<!-- launchwake-distribution-plan -->";

export function buildPlanComment(opts: {
  shipTitle: string;
  channelCount: number;
  topChannels: string[];
  planUrl: string;
  appUrl: string;
}): string {
  const base = opts.appUrl.replace(/\/$/, "");
  const n = opts.channelCount;
  const top = opts.topChannels.slice(0, 3);

  const lines = [
    PLAN_COMMENT_MARKER,
    "### 🌊 Distribution plan ready",
    "",
    `**LaunchWake** ranked **${n} channel${n === 1 ? "" : "s"}** for _${opts.shipTitle}_ — where to post it, each community's ban risk, and the safe way in.`,
  ];
  if (top.length > 0) {
    lines.push("", `**Top picks:** ${top.map((t) => `\`${t}\``).join(" · ")}`);
  }
  lines.push(
    "",
    `**[→ Open your distribution plan](${opts.planUrl})**`,
    "",
    `<sub>Automated by LaunchWake · [plan your launches free](${base}/?ref=action) · no login: [Launch Checker](${base}/tools/launch-checker)</sub>`,
  );
  return lines.join("\n");
}
