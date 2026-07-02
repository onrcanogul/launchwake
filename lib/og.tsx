import { ImageResponse } from "next/og";

/**
 * One branded OG card layout, shared by every opengraph-image route so shared
 * links (reports, channel pages, pricing, the landing) all open as rich,
 * consistent cards on X/LinkedIn. Cheap: next/og (satori), no external service.
 *
 * satori rule: a node with multiple children needs display:flex — every text
 * value here is a single string, so keep it that way when editing.
 */

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

const BG = "#0A0B0F";
const AC = "#3ECFB6";
const TX = "#E7E9ED";
const TX2 = "#9CA3B0";
const LINE = "rgba(255,255,255,0.10)";

export type OgStat = { label: string; value: string; color?: string };

export type OgCardOptions = {
  /** Small uppercase label above the title (e.g. "LAUNCH REPORT"). */
  eyebrow?: string;
  /** Muted line above the title (e.g. "How Hookline launched"). */
  kicker?: string;
  title: string;
  /** Optional bottom stat row. */
  stats?: OgStat[];
  /** Bottom-right note. */
  footer?: string;
};

/** Render the shared LaunchWake OG card as a PNG ImageResponse. */
export function ogCard(opts: OgCardOptions): ImageResponse {
  const { eyebrow, kicker, title, stats, footer = "Plan your launch → launchwake" } = opts;
  const shown = title.length > 74 ? title.slice(0, 73) + "…" : title;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: BG,
          padding: "64px 72px",
          fontFamily: "sans-serif",
        }}
      >
        {/* brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
            <path
              d="M2 15c2.2 0 2.2-3 4.4-3s2.2 3 4.4 3 2.2-3 4.4-3 2.2 3 4.4 3"
              stroke={AC}
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
          <div style={{ color: TX, fontSize: 30, fontWeight: 700, letterSpacing: -0.5 }}>
            LaunchWake
          </div>
          {eyebrow ? (
            <div style={{ color: TX2, fontSize: 22, marginLeft: 8 }}>{`· ${eyebrow}`}</div>
          ) : (
            <div style={{ display: "flex" }} />
          )}
        </div>

        {/* headline */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          {kicker ? (
            <div style={{ color: TX2, fontSize: 30, marginBottom: 14 }}>{kicker}</div>
          ) : (
            <div style={{ display: "flex" }} />
          )}
          <div
            style={{
              color: TX,
              fontSize: 66,
              fontWeight: 800,
              letterSpacing: -2,
              lineHeight: 1.05,
              maxWidth: 1010,
            }}
          >
            {shown}
          </div>
        </div>

        {/* stats / footer */}
        <div
          style={{
            display: "flex",
            gap: 56,
            borderTop: `1px solid ${LINE}`,
            paddingTop: 32,
            alignItems: "flex-end",
          }}
        >
          {(stats ?? []).map((s) => (
            <div key={s.label} style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ color: s.color ?? TX, fontSize: 50, fontWeight: 800, letterSpacing: -1 }}>
                {s.value}
              </div>
              <div style={{ color: TX2, fontSize: 22, textTransform: "uppercase", letterSpacing: 1 }}>
                {s.label}
              </div>
            </div>
          ))}
          <div
            style={{
              display: "flex",
              flex: 1,
              justifyContent: "flex-end",
              alignItems: "flex-end",
              color: TX2,
              fontSize: 22,
            }}
          >
            {footer}
          </div>
        </div>
      </div>
    ),
    OG_SIZE,
  );
}
