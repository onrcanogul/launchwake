import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  COMPARISON_PAIRS,
  comparisonSlug,
  getComparisonChannels,
  toPublicChannelLike,
  comparisonVerdict,
  explainBanRisk,
  postingChecklist,
} from "@/lib/publicCatalog";
import { breadcrumbJsonLd } from "@/lib/seoSchema";
import { JsonLd } from "@/components/public/JsonLd";
import { env } from "@/lib/env";
import { Link } from "@/i18n/navigation";
import { alternatesFor, localizedPath, type Locale } from "@/i18n/paths";
import { PublicShell } from "@/components/public/PublicShell";
import { Icon } from "@/components/Icon";
import { platformIcon } from "@/components/ui/platform";
import { RISK, type BanRiskValue } from "@/components/ui/risk";
import type { Channel } from "@prisma/client";

/**
 * Head-to-head comparison pages — "Show HN vs Product Hunt". One page per
 * curated pair (COMPARISON_PAIRS), grounded entirely in the seeded catalog:
 * risk levels, rules, audiences and a deterministic verdict. The verdict and
 * checklists are analysis content and stay in English (same rule as the
 * channel pages).
 */

export const revalidate = 86400;

export function generateStaticParams() {
  return COMPARISON_PAIRS.map((pair) => ({ pair: comparisonSlug(pair) }));
}

export async function generateMetadata(props: {
  params: Promise<{ locale: Locale; pair: string }>;
}): Promise<Metadata> {
  const { locale, pair } = await props.params;
  const t = await getTranslations({ locale, namespace: "Compare" });
  const channels = await getComparisonChannels(pair);
  if (!channels) return { title: t("notFound") };
  return {
    title: t("metaTitle", { a: channels.a.name, b: channels.b.name }),
    description: t("metaDescription", { a: channels.a.name, b: channels.b.name }),
    alternates: alternatesFor(`/channels/compare/${pair}`, locale),
  };
}

function ChannelColumn({
  channel,
  riskLabel,
  riskValueLabel,
  bestTimeLabel,
  audienceLabel,
  readMoreLabel,
}: {
  channel: Channel;
  riskLabel: string;
  riskValueLabel: string;
  bestTimeLabel: string;
  audienceLabel: string;
  readMoreLabel: string;
}) {
  const like = toPublicChannelLike(channel);
  const checklist = postingChecklist(like);
  const riskMeta = RISK[channel.defaultBanRisk as BanRiskValue];

  return (
    <div className="cd-do" style={{ minWidth: 0 }}>
      <div className="hd" style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Icon name={platformIcon(channel.platform)} />
        {channel.name}
      </div>
      <div className="cd-facts" style={{ marginTop: 10 }}>
        <div className="cd-fact">
          <div className="l">{riskLabel}</div>
          <div className="v">
            <span className="dot" style={{ background: riskMeta.color }} aria-hidden />
            {riskValueLabel}
          </div>
        </div>
        <div className="cd-fact">
          <div className="l">{bestTimeLabel}</div>
          <div className="v">{channel.bestTime ?? "—"}</div>
        </div>
        <div className="cd-fact">
          <div className="l">{audienceLabel}</div>
          <div
            className="v"
            style={{ fontSize: 12.5, fontWeight: 450, color: "var(--tx2)" }}
          >
            {channel.audienceDesc ?? "—"}
          </div>
        </div>
      </div>
      {channel.rules && (
        <div className="cd-rules" style={{ marginTop: 12 }}>
          {channel.rules}
        </div>
      )}
      <ul style={{ marginTop: 12 }}>
        {checklist.dos.map((d, i) => (
          <li key={i}>{d}</li>
        ))}
      </ul>
      <p style={{ marginTop: 12 }}>
        <Link
          href={`/channels/${channel.slug}`}
          style={{ fontSize: 13, color: "var(--tx1)" }}
        >
          {readMoreLabel}
        </Link>
      </p>
    </div>
  );
}

export default async function ComparePage(props: {
  params: Promise<{ locale: Locale; pair: string }>;
}) {
  const { locale, pair } = await props.params;
  setRequestLocale(locale);

  const channels = await getComparisonChannels(pair);
  if (!channels) notFound();

  const t = await getTranslations("Compare");
  const tc = await getTranslations("Common");
  const tr = await getTranslations("Risk");

  const aLike = toPublicChannelLike(channels.a);
  const bLike = toPublicChannelLike(channels.b);
  const verdict = comparisonVerdict(aLike, bLike);
  const aRisk = explainBanRisk(aLike);
  const bRisk = explainBanRisk(bLike);

  const base = env.APP_URL.replace(/\/$/, "");
  const abs = (cleanPath: string) => `${base}${localizedPath(cleanPath, locale)}`;
  const title = t("title", { a: channels.a.name, b: channels.b.name });

  const columnLabels = (c: Channel) => ({
    riskLabel: t("factBanRisk"),
    riskValueLabel: tr(c.defaultBanRisk as BanRiskValue),
    bestTimeLabel: t("factBestTime"),
    audienceLabel: t("factAudience"),
    readMoreLabel: t("readMore", { name: c.name }),
  });

  return (
    <PublicShell wide locale={locale}>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: t("breadcrumb"), url: abs("/channels") },
          { name: title, url: abs(`/channels/compare/${pair}`) },
        ])}
      />

      <div style={{ marginBottom: 18, fontSize: 12, color: "var(--tx3)" }}>
        <Link href="/channels" style={{ color: "var(--tx2)" }}>
          {t("breadcrumb")}
        </Link>{" "}
        / {title}
      </div>

      <div className="pub-eyebrow">
        <Icon name="shield" />
        {t("eyebrow")}
      </div>
      <h1 className="pub-h1">{title}</h1>
      <p className="pub-lede">{t("lede")}</p>

      <section className="cd-sec">
        <h2>
          <Icon name="check" />
          {t("verdictHeading")}
        </h2>
        <p style={{ fontSize: 13.5, color: "var(--tx2)", lineHeight: 1.6 }}>
          {verdict}
        </p>
      </section>

      <section className="cd-sec">
        <h2>
          <Icon name="rules" />
          {t("rulesHeading")}
        </h2>
        <div className="cd-cols">
          <ChannelColumn channel={channels.a} {...columnLabels(channels.a)} />
          <ChannelColumn channel={channels.b} {...columnLabels(channels.b)} />
        </div>
        {/* Deterministic risk factors per channel, from the seeded rules. */}
        <div className="cd-cols" style={{ marginTop: 14 }}>
          <ul className="cd-factors">
            {aRisk.factors.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
          <ul className="cd-factors">
            {bRisk.factors.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
      </section>

      <div className="gate">
        <h3>{t("gateTitle")}</h3>
        <p>{t("gateBody")}</p>
        <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
          <Link href="/tools/launch-checker" className="btn btn-p">
            <Icon name="target" />
            {tc("checkMyLaunch")}
          </Link>
        </div>
      </div>
    </PublicShell>
  );
}
