import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  getPublicChannel,
  listPublicChannelSlugs,
  explainBanRisk,
  postingChecklist,
} from "@/lib/publicCatalog";
import { Link } from "@/i18n/navigation";
import { alternatesFor, type Locale } from "@/i18n/paths";
import { PublicShell } from "@/components/public/PublicShell";
import { Icon } from "@/components/Icon";
import { platformIcon } from "@/components/ui/platform";
import { RISK, type BanRiskValue } from "@/components/ui/risk";

export const revalidate = 86400;

export async function generateStaticParams() {
  const slugs = await listPublicChannelSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata(props: {
  params: Promise<{ locale: Locale; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await props.params;
  const t = await getTranslations({ locale, namespace: "ChannelDetail" });
  const tr = await getTranslations({ locale, namespace: "Risk" });
  const channel = await getPublicChannel(slug);
  if (!channel) return { title: t("notFound") };
  const risk = tr(channel.defaultBanRisk as BanRiskValue).toLowerCase();
  return {
    title: `${t("question", { name: channel.name })} — ${t("metaTitleSuffix")}`,
    description: t("metaDescription", { name: channel.name, risk }),
    alternates: alternatesFor(`/channels/${slug}`, locale),
  };
}

export default async function ChannelPage(props: {
  params: Promise<{ locale: Locale; slug: string }>;
}) {
  const { locale, slug } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations("ChannelDetail");
  const tc = await getTranslations("Common");
  const tr = await getTranslations("Risk");
  const channel = await getPublicChannel(slug);
  if (!channel) notFound();

  const like = {
    slug: channel.slug,
    name: channel.name,
    platform: channel.platform,
    url: channel.url,
    audienceDesc: channel.audienceDesc,
    rules: channel.rules,
    defaultBanRisk: channel.defaultBanRisk as BanRiskValue,
    bestTime: channel.bestTime,
    tags: channel.tags,
  };

  // Note: the risk summary/factors and posting checklist are generated from the
  // seeded catalog rules (analysis content, not UI chrome) and stay in English.
  const risk = explainBanRisk(like);
  const checklist = postingChecklist(like);
  const riskValue = channel.defaultBanRisk as BanRiskValue;
  const riskMeta = RISK[riskValue];
  const riskLabel = tr(riskValue);

  return (
    <PublicShell locale={locale}>
      <div style={{ marginBottom: 18, fontSize: 12, color: "var(--tx3)" }}>
        <Link href="/channels" style={{ color: "var(--tx2)" }}>
          {t("breadcrumb")}
        </Link>{" "}
        / {channel.name}
      </div>

      <div className="pub-eyebrow">
        <Icon name={platformIcon(channel.platform)} />
        {channel.platform}
      </div>
      <h1 className="pub-h1">{t("question", { name: channel.name })}</h1>
      <p className="pub-lede">{risk.summary}</p>

      <div className="cd-facts">
        <div className="cd-fact">
          <div className="l">{t("factBanRisk")}</div>
          <div className="v">
            <span className="dot" style={{ background: riskMeta.color }} aria-hidden />
            {riskLabel}
          </div>
        </div>
        <div className="cd-fact">
          <div className="l">{t("factBestTime")}</div>
          <div className="v">{channel.bestTime ?? "—"}</div>
        </div>
        <div className="cd-fact">
          <div className="l">{t("factAudience")}</div>
          <div className="v" style={{ fontSize: 12.5, fontWeight: 450, color: "var(--tx2)" }}>
            {channel.audienceDesc ?? "—"}
          </div>
        </div>
      </div>

      <section className="cd-sec">
        <h2>
          <Icon name="shield" />
          {t("whyRiskHeading", { level: riskLabel.toLowerCase() })}
        </h2>
        <ul className="cd-factors">
          {risk.factors.map((f, i) => (
            <li key={i}>{f}</li>
          ))}
        </ul>
      </section>

      {channel.rules && (
        <section className="cd-sec">
          <h2>
            <Icon name="rules" />
            {t("rulesHeading")}
          </h2>
          <div className="cd-rules">{channel.rules}</div>
        </section>
      )}

      <section className="cd-sec">
        <h2>
          <Icon name="check" />
          {t("safeHeading")}
        </h2>
        <div className="cd-cols">
          <div className="cd-do">
            <div className="hd">{t("do")}</div>
            <ul>
              {checklist.dos.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          </div>
          <div className="cd-dont">
            <div className="hd">{t("dont")}</div>
            <ul>
              {checklist.donts.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <div className="gate">
        <h3>{t("gateTitle", { name: channel.name })}</h3>
        <p>{t("gateBody")}</p>
        <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
          <Link href="/tools/launch-checker" className="btn btn-p">
            <Icon name="target" />
            {tc("checkMyLaunch")}
          </Link>
          {channel.url && (
            <a
              href={channel.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="btn btn-s"
            >
              <Icon name="external" />
              {t("visit", { name: channel.name })}
            </a>
          )}
        </div>
      </div>
    </PublicShell>
  );
}
