import { ImageResponse } from "next/og";
import { getPublicReport, reportOgStats } from "@/lib/report";

export const runtime = "nodejs";
export const alt = "LaunchWake launch report";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * The viral card — what shows up when a report is shared on X/LinkedIn. Big
 * outcome numbers + LaunchWake branding. Rendered with next/og.
 */
export default async function OgImage(props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params;
  const report = await getPublicReport(token);

  const title = report ? report.ship.title : "Launch report";
  const project = report ? report.project.name : "LaunchWake";
  const stats = report ? reportOgStats(report) : [];

  const bg = "#0A0B0F";
  const ac = "#3ECFB6";
  const tx = "#E7E9ED";
  const tx2 = "#9CA3B0";
  const line = "rgba(255,255,255,0.10)";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: bg,
          padding: "64px 72px",
          fontFamily: "sans-serif",
        }}
      >
        {/* brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
            <path d="M2 15c2.2 0 2.2-3 4.4-3s2.2 3 4.4 3 2.2-3 4.4-3 2.2 3 4.4 3" stroke={ac} strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <div style={{ color: tx, fontSize: 30, fontWeight: 700, letterSpacing: -0.5 }}>LaunchWake</div>
          <div style={{ color: tx2, fontSize: 22, marginLeft: 8 }}>· launch report</div>
        </div>

        {/* headline */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ color: tx2, fontSize: 30, marginBottom: 14 }}>
            {`How ${project} launched`}
          </div>
          <div style={{ color: tx, fontSize: 68, fontWeight: 800, letterSpacing: -2, lineHeight: 1.05, maxWidth: 1000 }}>
            {title.length > 64 ? title.slice(0, 63) + "…" : title}
          </div>
        </div>

        {/* stats */}
        <div style={{ display: "flex", gap: 56, borderTop: `1px solid ${line}`, paddingTop: 32 }}>
          {stats.map((s) => (
            <div key={s.label} style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ color: s.label === "revenue" ? ac : tx, fontSize: 52, fontWeight: 800, letterSpacing: -1 }}>
                {s.value}
              </div>
              <div style={{ color: tx2, fontSize: 22, textTransform: "uppercase", letterSpacing: 1 }}>{s.label}</div>
            </div>
          ))}
          <div style={{ display: "flex", flex: 1, justifyContent: "flex-end", alignItems: "flex-end", color: tx2, fontSize: 22 }}>
            Plan your launch → launchwake
          </div>
        </div>
      </div>
    ),
    size,
  );
}
