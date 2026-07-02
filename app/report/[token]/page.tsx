import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicReport, reportMetaDescription } from "@/lib/report";
import { formatMoney } from "@/lib/attribution";
import { PublicShell } from "@/components/public/PublicShell";
import { RoiStrip } from "@/components/results/RoiStrip";
import { PoweredByLaunchWake } from "@/components/public/PoweredBy";
import { Icon } from "@/components/Icon";
import { platformIcon } from "@/components/ui/platform";
import { RISK, type BanRiskValue } from "@/components/ui/risk";

export const revalidate = 300;

const SHIP_LABEL: Record<string, string> = {
  LAUNCH: "Launch",
  FEATURE: "Feature",
  BLOG: "Blog post",
  OTHER: "Update",
};

export async function generateMetadata(props: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await props.params;
  const report = await getPublicReport(token);
  if (!report) return { title: "Launch report not found — LaunchWake" };
  const title = `How ${report.project.name} launched "${report.ship.title}" — LaunchWake`;
  const description = reportMetaDescription(report);
  return {
    title,
    description,
    alternates: { canonical: `/report/${token}` },
    openGraph: { title, description, type: "article" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function ReportPage(props: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await props.params;
  const report = await getPublicReport(token);
  if (!report) notFound();

  const { project, ship, channels, totals, roi, topRevenueChannel, showRevenue } = report;
  const hasData = totals.clicks > 0 || totals.signups > 0 || (totals.revenueCents ?? 0) > 0;

  return (
    <PublicShell>
      <div className="pub-eyebrow">
        <Icon name="rocket" />
        {SHIP_LABEL[ship.type] ?? "Launch"} report
      </div>
      <h1 className="pub-h1">
        How {project.name} launched{" "}
        <span className="ac-word">&ldquo;{ship.title}&rdquo;</span>
      </h1>
      {ship.summary && <p className="pub-lede">{ship.summary}</p>}

      {hasData && (
        <div style={{ marginTop: 24 }}>
          <RoiStrip roi={roi} topRevenueChannel={topRevenueChannel} />
        </div>
      )}

      {/* Where they posted */}
      <section className="cd-sec">
        <h2>
          <Icon name="where" />
          Where {project.name} posted it
        </h2>
        <div className="rep-list">
          {channels.map((c) => {
            const risk = RISK[c.banRisk as BanRiskValue];
            return (
              <div className="rep-row" key={c.name}>
                <div className="rep-top">
                  <Icon name={platformIcon(c.platform)} className="pi" />
                  <span className="rep-name">{c.name}</span>
                  <span className="rep-fit">
                    <span className="dot" style={{ background: risk.color }} />
                    {risk.label} risk
                  </span>
                  {c.bestTime && <span className="rep-time">{c.bestTime}</span>}
                </div>
                <div className="rep-why">{c.why}</div>
                <div className="rep-metrics">
                  <span>
                    <b className="num">{c.clicks.toLocaleString()}</b> clicks
                  </span>
                  <span>
                    <b className="num">{c.signups.toLocaleString()}</b> signups
                  </span>
                  {showRevenue && c.revenueCents !== null && (
                    <span style={{ color: c.revenueCents > 0 ? "var(--ac)" : "var(--tx3)" }}>
                      <b className="num">
                        {c.revenueCents > 0 ? formatMoney(c.revenueCents, roi.currency) : "—"}
                      </b>{" "}
                      revenue
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA — the loop */}
      <div className="gate" style={{ marginTop: 30 }}>
        <h3>Planning your own launch?</h3>
        <p>
          LaunchWake told {project.name} exactly where to post this, how to post
          without getting banned, and which channels actually drove signups. Do
          the same for your product — free, no account needed.
        </p>
        <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
          <Link href="/tools/launch-checker" className="btn btn-p">
            <Icon name="target" />
            Check my launch
          </Link>
          <Link href="/channels" className="btn btn-s">
            <Icon name="shield" />
            Browse channels
          </Link>
        </div>
      </div>

      <div style={{ marginTop: 24, display: "flex", justifyContent: "center" }}>
        <PoweredByLaunchWake refSource="report" />
      </div>
    </PublicShell>
  );
}
