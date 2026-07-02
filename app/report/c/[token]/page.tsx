import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { getClientReport } from "@/lib/clientReport";
import { formatMoney } from "@/lib/attribution";
import { RoiStrip } from "@/components/results/RoiStrip";
import { PrintButton } from "@/components/report/PrintButton";

export const revalidate = 300;

export async function generateMetadata(props: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await props.params;
  const report = await getClientReport(token);
  if (!report) return { title: "Report not found", robots: { index: false, follow: false } };
  const who = report.brand?.agencyName ? `${report.brand.agencyName} · ` : "";
  const title = `${who}${report.project.name} — distribution report`;
  const description = `${report.project.name} distribution report${report.brand?.agencyName ? ` — prepared by ${report.brand.agencyName}` : ""}.`;
  // White-label: override the app's default LaunchWake meta so a shared link
  // shows the agency, not us. Private link → noindex.
  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: { title, description, images: [] },
    twitter: { card: "summary", title, description, images: [] },
  };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function fmtDate(d: Date): string {
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

export default async function ClientReportPage(props: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await props.params;
  const report = await getClientReport(token);
  if (!report) notFound();

  const { brand, project, totals, roi, topRevenueChannel, perChannel, generatedAt } = report;
  const accentStyle = { "--ac": brand?.accentColor ?? "#3ecfb6" } as CSSProperties;
  const hasData = totals.clicks > 0 || totals.signups > 0 || totals.revenueCents > 0;
  const hasRevenue = totals.revenueCents > 0;

  return (
    <div className="wl" style={accentStyle}>
      <header className="wl-bar">
        <div className="wl-brand">
          {brand?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brand.logoUrl} alt={brand.agencyName} className="wl-logo" />
          ) : (
            <span className="wl-mark" style={{ background: brand?.accentColor ?? "#3ecfb6" }} />
          )}
          <span className="wl-agency">{brand?.agencyName ?? "Distribution report"}</span>
        </div>
        <PrintButton />
      </header>

      <main className="wl-wrap">
        <div className="wl-eyebrow">Distribution report</div>
        <h1 className="wl-h1">{project.name}</h1>
        <p className="wl-lede">
          Where {project.name} was distributed and what it drove.{" "}
          <span className="wl-muted">Prepared {fmtDate(generatedAt)}.</span>
        </p>

        {hasData ? (
          <>
            <div className="wl-roi">
              <RoiStrip roi={roi} topRevenueChannel={topRevenueChannel} />
            </div>

            <section className="wl-sec">
              <h2>Channel breakdown</h2>
              <div className="tblwrap">
                <table>
                  <thead>
                    <tr>
                      <th>Channel</th>
                      <th style={{ textAlign: "right" }}>Clicks</th>
                      <th style={{ textAlign: "right" }}>Signups</th>
                      {hasRevenue && <th style={{ textAlign: "right" }}>Revenue</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {perChannel.map((c) => (
                      <tr key={c.name}>
                        <td>
                          <b>{c.name}</b>
                        </td>
                        <td className="num" style={{ textAlign: "right" }}>
                          {c.clicks.toLocaleString()}
                        </td>
                        <td className="num" style={{ textAlign: "right" }}>
                          {c.signups.toLocaleString()}
                        </td>
                        {hasRevenue && (
                          <td className="num" style={{ textAlign: "right" }}>
                            {c.revenueCents > 0 ? formatMoney(c.revenueCents, totals.currency) : "—"}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : (
          <div className="wl-empty">
            No tracked results yet for this period. Once distribution links start
            getting clicks, this report fills in automatically.
          </div>
        )}
      </main>

      <footer className="wl-foot">
        Prepared by {brand?.agencyName ?? "your distribution team"}
        {project.url ? ` · ${project.url.replace(/^https?:\/\//, "")}` : ""}
      </footer>
    </div>
  );
}
