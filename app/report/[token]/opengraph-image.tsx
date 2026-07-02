import { getPublicReport, reportOgStats } from "@/lib/report";
import { ogCard, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";

export const runtime = "nodejs";
export const alt = "LaunchWake launch report";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

const SHIP_LABEL: Record<string, string> = {
  LAUNCH: "launch report",
  FEATURE: "feature report",
  BLOG: "blog report",
  OTHER: "launch report",
};

/** The viral card — big outcome numbers when a report is shared. */
export default async function OgImage(props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params;
  const report = await getPublicReport(token);
  if (!report) {
    return ogCard({ eyebrow: "launch report", title: "Launch report" });
  }
  return ogCard({
    eyebrow: SHIP_LABEL[report.ship.type] ?? "launch report",
    kicker: `How ${report.project.name} launched`,
    title: report.ship.title,
    stats: reportOgStats(report).map((s) => ({
      ...s,
      color: s.label === "revenue" ? "#3ECFB6" : undefined,
    })),
  });
}
