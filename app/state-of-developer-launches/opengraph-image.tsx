import { getStateOfLaunches, stateOfLaunchesOgStats } from "@/lib/stateOfLaunches";
import { ogCard, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";

export const runtime = "nodejs";
export const alt = "The State of Developer Launches — LaunchWake";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

/** Press-ready card: the report headline + the aggregate numbers behind it. */
export default async function OgImage() {
  const report = await getStateOfLaunches();
  return ogCard({
    eyebrow: "annual data report",
    kicker: "Where developer products actually get signups",
    title: "The State of Developer Launches",
    stats: report.hasData
      ? stateOfLaunchesOgStats(report).map((s) => ({ label: s.label, value: s.value }))
      : undefined,
    footer: "launchwake — distribution intelligence",
  });
}
