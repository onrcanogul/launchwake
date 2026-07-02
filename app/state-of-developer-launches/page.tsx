import Link from "next/link";
import type { Metadata } from "next";
import {
  getStateOfLaunches,
  MIN_SAMPLE_POSTS,
  type ChannelLeader,
} from "@/lib/stateOfLaunches";
import { PublicShell } from "@/components/public/PublicShell";
import { PoweredByLaunchWake } from "@/components/public/PoweredBy";
import { StatStrip } from "@/components/ui/StatStrip";
import { Icon } from "@/components/Icon";
import { platformIcon, platformLabel } from "@/components/ui/platform";
import { RISK, type BanRiskValue } from "@/components/ui/risk";

// Aggregate flywheel data changes slowly — cache and revalidate hourly.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "The State of Developer Launches — where dev products actually get signups",
  description:
    "An anonymized aggregate of thousands of developer product launches: which channels drive the most signups, which convert best, how it differs by category, where posts get removed, and the best time to post.",
  alternates: { canonical: "/state-of-developer-launches" },
  openGraph: {
    title: "The State of Developer Launches",
    description:
      "Where developer products actually get signups — an anonymized aggregate of real launches, by channel, category, ban risk and timing.",
    type: "article",
  },
  twitter: { card: "summary_large_image" },
};

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

/** A single channel row with a signup bar scaled to the section's max. */
function LeaderRow({
  rank,
  channel,
  max,
}: {
  rank: number;
  channel: ChannelLeader;
  max: number;
}) {
  const risk = RISK[channel.banRisk as BanRiskValue];
  const width = max > 0 ? Math.max(3, (channel.signups / max) * 100) : 0;
  return (
    <div className="sol-row">
      <span className="sol-rank num">{rank}</span>
      <div className="sol-main">
        <div className="sol-name">
          <Icon name={platformIcon(channel.platform)} className="pi" />
          <span>{channel.name}</span>
          <span className="sol-risk">
            <span className="dot" style={{ background: risk.color }} aria-hidden />
            {risk.label} risk
          </span>
        </div>
        <div className="sol-track" aria-hidden>
          <span className="sol-fill" style={{ width: `${width}%` }} />
        </div>
      </div>
      <div className="sol-metric">
        <b className="num">{channel.signups.toLocaleString()}</b>
        <span>signups · {pct(channel.conversion)} conv</span>
      </div>
    </div>
  );
}

export default async function StateOfDeveloperLaunchesPage() {
  const report = await getStateOfLaunches();
  const year = new Date().getFullYear();
  const { totals } = report;

  return (
    <PublicShell wide>
      <div className="pub-eyebrow">
        <Icon name="results" />
        Annual data report
      </div>
      <h1 className="pub-h1">
        The State of Developer Launches{" "}
        <span className="ac-word">{year}</span>
      </h1>
      <p className="pub-lede">
        We aggregated where technical founders actually launch — anonymized across
        every tracked launch — to answer the question no blog post can: which
        channels really drive signups, which convert, and where posts get removed.
      </p>

      {!report.hasData ? (
        <div className="gate" style={{ marginTop: 28 }}>
          <h3>The {year} report is still compiling</h3>
          <p>
            This report is built from real launch outcomes as founders run their
            distribution plans through LaunchWake. Once enough launches are tracked
            (we only publish a channel after at least {MIN_SAMPLE_POSTS} posts, so
            no single founder&apos;s numbers are ever exposed), the full breakdown
            appears here — by channel, category, ban risk and timing.
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            <Link href="/tools/launch-checker" className="btn btn-p">
              <Icon name="target" />
              Plan a launch
            </Link>
            <Link href="/channels" className="btn btn-s">
              <Icon name="shield" />
              Browse channels
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div style={{ marginTop: 24 }}>
            <StatStrip
              stats={[
                { label: "Launches tracked", value: totals.launches.toLocaleString(), icon: "rocket" },
                { label: "Signups attributed", value: totals.signups.toLocaleString(), icon: "results" },
                { label: "Avg. conversion", value: pct(totals.conversion), icon: "target" },
                { label: "Channels ranked", value: String(totals.channelsRanked), icon: "channels" },
              ]}
            />
          </div>

          {/* Top channels overall */}
          <section className="cd-sec">
            <h2>
              <Icon name="results" />
              Top channels by signups
            </h2>
            <div className="sol-board">
              {report.topChannels.map((c, i) => (
                <LeaderRow
                  key={c.name}
                  rank={i + 1}
                  channel={c}
                  max={report.topChannels[0]?.signups ?? 0}
                />
              ))}
            </div>
          </section>

          {/* Best converters */}
          {report.bestConverters.length > 0 && (
            <section className="cd-sec">
              <h2>
                <Icon name="target" />
                Best converters (signups per click)
              </h2>
              <p className="sol-subnote">
                Channels with at least real traffic behind them — raw reach means
                nothing if it doesn&apos;t convert.
              </p>
              <div className="sol-conv">
                {report.bestConverters.map((c) => (
                  <div className="sol-conv-row" key={c.name}>
                    <Icon name={platformIcon(c.platform)} className="pi" />
                    <span className="sol-conv-name">{c.name}</span>
                    <span className="sol-conv-val num">{pct(c.conversion)}</span>
                    <span className="sol-conv-detail">
                      {c.signups.toLocaleString()} signups / {c.clicks.toLocaleString()} clicks
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* By category */}
          {report.categories.length > 0 && (
            <section className="cd-sec">
              <h2>
                <Icon name="grid" />
                Where each category gets signups
              </h2>
              <div className="sol-cats">
                {report.categories.map((cat) => (
                  <div className="sol-cat" key={cat.tag}>
                    <div className="sol-cat-head">
                      <span className="sol-cat-name">{cat.label}</span>
                      <span className="sol-cat-total num">
                        {cat.signups.toLocaleString()} signups
                      </span>
                    </div>
                    <ol className="sol-cat-list">
                      {cat.topChannels.map((c, i) => (
                        <li key={c.name}>
                          <span className="sol-cat-rank num">{i + 1}</span>
                          <Icon name={platformIcon(c.platform)} className="pi" />
                          <span className="sol-cat-ch">{c.name}</span>
                          <span className="sol-cat-sg num">
                            {c.signups.toLocaleString()}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Ban rates */}
          {report.banRates.length > 0 && (
            <section className="cd-sec">
              <h2>
                <Icon name="shield" />
                Where posts get removed
              </h2>
              <div className="sol-bans">
                {report.banRates.map((b) => {
                  const maxRate = report.banRates[0]?.removalRate || 1;
                  const width = Math.max(2, (b.removalRate / maxRate) * 100);
                  const hot = b.removalRate >= 0.15;
                  return (
                    <div className="sol-ban-row" key={b.platform}>
                      <span className="sol-ban-name">{platformLabel(b.platform)}</span>
                      <div className="sol-track" aria-hidden>
                        <span
                          className="sol-fill"
                          style={{
                            width: `${width}%`,
                            background: hot ? "var(--bad)" : "var(--warn)",
                          }}
                        />
                      </div>
                      <span className="sol-ban-val num">{pct(b.removalRate)}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Best times */}
          {report.bestTimes.length > 0 && (
            <section className="cd-sec">
              <h2>
                <Icon name="clock" />
                The best time to post
              </h2>
              <div className="sol-times">
                {report.bestTimes.map((t) => (
                  <div className="sol-time" key={t.window}>
                    <span className="sol-time-win">{t.window}</span>
                    <span className="sol-time-ch">{t.channels.join(", ")}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Methodology */}
          <section className="cd-sec">
            <h2>
              <Icon name="rules" />
              How we built this
            </h2>
            <div className="cd-rules">
              Every number comes from anonymized, aggregate launch outcomes — never
              any individual account. A channel appears only once it has at least{" "}
              {MIN_SAMPLE_POSTS} tracked posts behind it, so no single founder&apos;s
              results can be inferred. Channels are grounded in LaunchWake&apos;s
              curated catalog, so the report reflects communities founders actually
              post in — not invented ones. Conversion is signups ÷ tracked-link
              clicks; removal rate is removed posts ÷ total posts.
            </div>
          </section>
        </>
      )}

      {/* CTA — the loop */}
      <div className="gate" style={{ marginTop: 30 }}>
        <h3>Want this signal for your next launch?</h3>
        <p>
          LaunchWake turns this aggregate into a plan for your specific product:
          where to post, how to post without getting banned, and which channels
          actually drive your signups — free, no account needed.
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
        <PoweredByLaunchWake refSource="state-of-launches" />
      </div>
    </PublicShell>
  );
}
