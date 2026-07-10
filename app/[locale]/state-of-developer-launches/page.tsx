import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { useTranslations } from "next-intl";
import {
  getStateOfLaunches,
  getPublicBenchmarkBoard,
  MIN_SAMPLE_POSTS,
  type ChannelLeader,
  type PublicBenchmarkBoard,
} from "@/lib/stateOfLaunches";
import { Link } from "@/i18n/navigation";
import { alternatesFor, type Locale } from "@/i18n/paths";
import { PublicShell } from "@/components/public/PublicShell";
import { PoweredByLaunchWake } from "@/components/public/PoweredBy";
import { StatStrip } from "@/components/ui/StatStrip";
import { Icon } from "@/components/Icon";
import { platformIcon, platformLabel } from "@/components/ui/platform";
import { RISK, type BanRiskValue } from "@/components/ui/risk";

// Aggregate flywheel data changes slowly — cache and revalidate hourly.
export const revalidate = 3600;

export async function generateMetadata(props: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: "StateOfLaunches" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: alternatesFor("/state-of-developer-launches", locale),
    openGraph: {
      title: t("ogTitle"),
      description: t("ogDescription"),
      type: "article",
    },
    twitter: { card: "summary_large_image" },
  };
}

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
  const t = useTranslations("StateOfLaunches");
  const tr = useTranslations("Risk");
  const riskValue = channel.banRisk as BanRiskValue;
  const risk = RISK[riskValue];
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
            {tr(riskValue)} {t("riskSuffix")}
          </span>
        </div>
        <div className="sol-track" aria-hidden>
          <span className="sol-fill" style={{ width: `${width}%` }} />
        </div>
      </div>
      <div className="sol-metric">
        <b className="num">{channel.signups.toLocaleString()}</b>
        <span>
          {t("signups")} · {pct(channel.conversion)} {t("conv")}
        </span>
      </div>
    </div>
  );
}

/** Public-engagement board (HN/PH medians) — the cold-start signal, shown as its
 *  own clearly-labelled section, never blended into first-party numbers. */
function PublicBenchmarkSection({ board }: { board: PublicBenchmarkBoard }) {
  const t = useTranslations("StateOfLaunches");
  return (
    <section className="cd-sec">
      <h2>
        <Icon name="results" />
        {t("publicHeading")}
      </h2>
      <p className="sol-subnote">{t("publicNote")}</p>
      <div className="sol-cats">
        {board.categories.map((cat) => (
          <div className="sol-cat" key={cat.tag}>
            <div className="sol-cat-head">
              <span className="sol-cat-name">{cat.label}</span>
            </div>
            <ol className="sol-cat-list">
              {cat.channels.map((c, i) => (
                <li key={c.name}>
                  <span className="sol-cat-rank num">{i + 1}</span>
                  <Icon name={platformIcon(c.platform)} className="pi" />
                  <span className="sol-cat-ch">{c.name}</span>
                  <span className="sol-cat-sg num">
                    {c.medianUpvotes.toLocaleString()} {t("publicPoints")}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </section>
  );
}

export default async function StateOfDeveloperLaunchesPage(props: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations("StateOfLaunches");
  const tc = await getTranslations("Common");
  const [report, publicBoard] = await Promise.all([
    getStateOfLaunches(),
    getPublicBenchmarkBoard(),
  ]);
  const year = new Date().getFullYear();
  const { totals } = report;

  return (
    <PublicShell wide locale={locale}>
      <div className="pub-eyebrow">
        <Icon name="results" />
        {t("eyebrow")}
      </div>
      <h1 className="pub-h1">
        {t("titleLead")}
        <span className="ac-word">{year}</span>
      </h1>
      <p className="pub-lede">{t("lede")}</p>

      {!report.hasData ? (
        <>
          {/* Cold start: show the public engagement board instead of only a gate. */}
          {publicBoard.hasData && <PublicBenchmarkSection board={publicBoard} />}
          <div className="gate" style={{ marginTop: 28 }}>
            <h3>{t("compilingTitle", { year })}</h3>
            <p>
              {publicBoard.hasData
                ? t("publicCompiling")
                : t("compilingBody", { min: MIN_SAMPLE_POSTS })}
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
              <Link href="/tools/launch-checker" className="btn btn-p">
                <Icon name="target" />
                {tc("planALaunch")}
              </Link>
              <Link href="/channels" className="btn btn-s">
                <Icon name="shield" />
                {tc("browseChannels")}
              </Link>
            </div>
          </div>
        </>
      ) : (
        <>
          <div style={{ marginTop: 24 }}>
            <StatStrip
              stats={[
                { label: t("statLaunches"), value: totals.launches.toLocaleString(), icon: "rocket" },
                { label: t("statSignups"), value: totals.signups.toLocaleString(), icon: "results" },
                { label: t("statConversion"), value: pct(totals.conversion), icon: "target" },
                { label: t("statChannels"), value: String(totals.channelsRanked), icon: "channels" },
              ]}
            />
          </div>

          {/* Top channels overall */}
          <section className="cd-sec">
            <h2>
              <Icon name="results" />
              {t("topChannelsHeading")}
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
                {t("bestConvertersHeading")}
              </h2>
              <p className="sol-subnote">{t("bestConvertersNote")}</p>
              <div className="sol-conv">
                {report.bestConverters.map((c) => (
                  <div className="sol-conv-row" key={c.name}>
                    <Icon name={platformIcon(c.platform)} className="pi" />
                    <span className="sol-conv-name">{c.name}</span>
                    <span className="sol-conv-val num">{pct(c.conversion)}</span>
                    <span className="sol-conv-detail">
                      {t("signupsSlashClicks", {
                        signups: c.signups.toLocaleString(),
                        clicks: c.clicks.toLocaleString(),
                      })}
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
                {t("byCategoryHeading")}
              </h2>
              <div className="sol-cats">
                {report.categories.map((cat) => (
                  <div className="sol-cat" key={cat.tag}>
                    <div className="sol-cat-head">
                      <span className="sol-cat-name">{cat.label}</span>
                      <span className="sol-cat-total num">
                        {cat.signups.toLocaleString()} {t("signups")}
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

          {/* Public engagement board — additional cold-start signal alongside
              the first-party numbers, never blended into them. */}
          {publicBoard.hasData && <PublicBenchmarkSection board={publicBoard} />}

          {/* Ban rates */}
          {report.banRates.length > 0 && (
            <section className="cd-sec">
              <h2>
                <Icon name="shield" />
                {t("banRatesHeading")}
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
                {t("bestTimesHeading")}
              </h2>
              <div className="sol-times">
                {report.bestTimes.map((tw) => (
                  <div className="sol-time" key={tw.window}>
                    <span className="sol-time-win">{tw.window}</span>
                    <span className="sol-time-ch">{tw.channels.join(", ")}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Methodology */}
          <section className="cd-sec">
            <h2>
              <Icon name="rules" />
              {t("methodologyHeading")}
            </h2>
            <div className="cd-rules">{t("methodologyBody", { min: MIN_SAMPLE_POSTS })}</div>
          </section>
        </>
      )}

      {/* CTA — the loop */}
      <div className="gate" style={{ marginTop: 30 }}>
        <h3>{t("ctaTitle")}</h3>
        <p>{t("ctaBody")}</p>
        <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
          <Link href="/tools/launch-checker" className="btn btn-p">
            <Icon name="target" />
            {tc("checkMyLaunch")}
          </Link>
          <Link href="/channels" className="btn btn-s">
            <Icon name="shield" />
            {tc("browseChannels")}
          </Link>
        </div>
      </div>

      <div style={{ marginTop: 24, display: "flex", justifyContent: "center" }}>
        <PoweredByLaunchWake refSource="state-of-launches" />
      </div>
    </PublicShell>
  );
}
