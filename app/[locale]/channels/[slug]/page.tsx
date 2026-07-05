import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  getPublicChannel,
  listPublicChannelSlugs,
  listPublicChannelLikes,
  explainBanRisk,
  postingChecklist,
  channelFaq,
  relatedChannels,
  isTagHub,
} from "@/lib/publicCatalog";
import { parseAccountRequirements } from "@/lib/accountReadiness";
import { faqPageJsonLd, breadcrumbJsonLd } from "@/lib/seoSchema";
import { JsonLd } from "@/components/public/JsonLd";
import { env } from "@/lib/env";
import { Link } from "@/i18n/navigation";
import { alternatesFor, localizedPath, type Locale } from "@/i18n/paths";
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

  // Note: the risk summary/factors, posting checklist and FAQ are generated
  // from the seeded catalog rules (analysis content, not UI chrome) and stay
  // in English.
  const risk = explainBanRisk(like);
  const checklist = postingChecklist(like);
  const riskValue = channel.defaultBanRisk as BanRiskValue;
  const riskMeta = RISK[riskValue];
  const riskLabel = tr(riskValue);

  const requirements = parseAccountRequirements(channel.accountRequirements);
  const faq = channelFaq(like, requirements);
  const related = relatedChannels(like, await listPublicChannelLikes());
  const hubs = channel.tags.filter(isTagHub);
  const tf = await getTranslations("ForTag");

  const base = env.APP_URL.replace(/\/$/, "");
  const abs = (cleanPath: string) => `${base}${localizedPath(cleanPath, locale)}`;

  return (
    <PublicShell locale={locale}>
      <JsonLd data={faqPageJsonLd(faq)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: t("breadcrumb"), url: abs("/channels") },
          { name: channel.name, url: abs(`/channels/${channel.slug}`) },
        ])}
      />
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

      {requirements && (
        <section className="cd-sec">
          <h2>
            <Icon name="check" />
            {t("accountHeading")}
          </h2>
          <div className="cd-facts">
            {requirements.minAccountAgeDays != null && (
              <div className="cd-fact">
                <div className="l">{t("accountMinAge")}</div>
                <div className="v">
                  {t("accountMinAgeValue", { days: requirements.minAccountAgeDays })}
                </div>
              </div>
            )}
            {requirements.minKarmaOrReputation && (
              <div className="cd-fact">
                <div className="l">{t("accountKarma")}</div>
                <div className="v">
                  {requirements.minKarmaOrReputation.value}+{" "}
                  {requirements.minKarmaOrReputation.unit}
                </div>
              </div>
            )}
            <div className="cd-fact">
              <div className="l">{t("accountLevel")}</div>
              <div className="v">
                {requirements.level === "required"
                  ? t("accountLevelRequired")
                  : t("accountLevelRecommended")}
              </div>
            </div>
          </div>
          {requirements.profileTips && requirements.profileTips.length > 0 && (
            <ul className="cd-factors" style={{ marginTop: 12 }}>
              {requirements.profileTips.map((tip, i) => (
                <li key={i}>{tip}</li>
              ))}
            </ul>
          )}
          <p style={{ marginTop: 10, fontSize: 12, color: "var(--tx3)" }}>
            {t("accountSource")}: {requirements.sourceNote}
          </p>
        </section>
      )}

      <section className="cd-sec">
        <h2>
          <Icon name="rules" />
          {t("faqHeading")}
        </h2>
        {faq.map((f, i) => (
          <div key={i} style={{ marginBottom: 14 }}>
            <h3 style={{ fontSize: 14, marginBottom: 4 }}>{f.question}</h3>
            <p style={{ fontSize: 13.5, color: "var(--tx2)", lineHeight: 1.55 }}>
              {f.answer}
            </p>
          </div>
        ))}
      </section>

      {(related.length > 0 || hubs.length > 0) && (
        <section className="cd-sec">
          <h2>
            <Icon name="target" />
            {t("relatedHeading")}
          </h2>
          {related.length > 0 && (
            <div className="ch-grid">
              {related.map((c) => (
                <Link key={c.slug} href={`/channels/${c.slug}`} className="ch-card">
                  <div className="top">
                    <Icon name={platformIcon(c.platform)} />
                    <span className="nm">{c.name}</span>
                  </div>
                  {c.audienceDesc && <div className="aud">{c.audienceDesc}</div>}
                  <div className="ft">
                    <span
                      className="dot"
                      style={{ background: RISK[c.defaultBanRisk].color }}
                      aria-hidden
                    />
                    {tr(c.defaultBanRisk)}
                  </div>
                </Link>
              ))}
            </div>
          )}
          {hubs.length > 0 && (
            <p style={{ marginTop: 14, fontSize: 13, color: "var(--tx2)" }}>
              {t("appearsIn")}{" "}
              {hubs.map((hub, i) => (
                <span key={hub}>
                  {i > 0 && " · "}
                  <Link href={`/channels/for/${hub}`} style={{ color: "var(--tx1)" }}>
                    {tf(`hubs.${hub}.title`)}
                  </Link>
                </span>
              ))}
            </p>
          )}
        </section>
      )}

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
