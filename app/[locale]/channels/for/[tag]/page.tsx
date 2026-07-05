import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  TAG_HUBS,
  isTagHub,
  listChannelsByTag,
} from "@/lib/publicCatalog";
import { itemListJsonLd, breadcrumbJsonLd } from "@/lib/seoSchema";
import { JsonLd } from "@/components/public/JsonLd";
import { env } from "@/lib/env";
import { Link } from "@/i18n/navigation";
import { alternatesFor, localizedPath, type Locale } from "@/i18n/paths";
import { PublicShell } from "@/components/public/PublicShell";
import { Icon } from "@/components/Icon";
import { platformIcon } from "@/components/ui/platform";
import { RISK, type BanRiskValue } from "@/components/ui/risk";

/**
 * Tag hub pages — "best places to launch a devtool" and friends. One page per
 * curated launch category (TAG_HUBS), listing the catalog's channels for that
 * tag safest-first. Pure programmatic SEO: the query is the title, the catalog
 * is the content, and every card links into a channel's ban-risk page.
 */

export const revalidate = 86400;

export function generateStaticParams() {
  return TAG_HUBS.map((tag) => ({ tag }));
}

export async function generateMetadata(props: {
  params: Promise<{ locale: Locale; tag: string }>;
}): Promise<Metadata> {
  const { locale, tag } = await props.params;
  const t = await getTranslations({ locale, namespace: "ForTag" });
  if (!isTagHub(tag)) return { title: t("notFound") };
  const channels = await listChannelsByTag(tag);
  const title = t(`hubs.${tag}.title`);
  return {
    title: `${title} — ${t("metaTitleSuffix")}`,
    description: t("metaDescription", { title, count: channels.length }),
    alternates: alternatesFor(`/channels/for/${tag}`, locale),
  };
}

export default async function TagHubPage(props: {
  params: Promise<{ locale: Locale; tag: string }>;
}) {
  const { locale, tag } = await props.params;
  setRequestLocale(locale);
  if (!isTagHub(tag)) notFound();

  const t = await getTranslations("ForTag");
  const tc = await getTranslations("Common");
  const tr = await getTranslations("Risk");
  const channels = await listChannelsByTag(tag);
  if (channels.length === 0) notFound();

  const title = t(`hubs.${tag}.title`);
  const base = env.APP_URL.replace(/\/$/, "");
  const abs = (cleanPath: string) => `${base}${localizedPath(cleanPath, locale)}`;

  return (
    <PublicShell wide locale={locale}>
      <JsonLd
        data={itemListJsonLd(
          channels.map((c) => ({ name: c.name, url: abs(`/channels/${c.slug}`) })),
        )}
      />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: t("breadcrumb"), url: abs("/channels") },
          { name: title, url: abs(`/channels/for/${tag}`) },
        ])}
      />

      <div style={{ marginBottom: 18, fontSize: 12, color: "var(--tx3)" }}>
        <Link href="/channels" style={{ color: "var(--tx2)" }}>
          {t("breadcrumb")}
        </Link>{" "}
        / {title}
      </div>

      <div className="pub-eyebrow">
        <Icon name="target" />
        {t("eyebrow")}
      </div>
      <h1 className="pub-h1">{title}</h1>
      <p className="pub-lede">{t(`hubs.${tag}.lede`)}</p>
      <p style={{ fontSize: 12.5, color: "var(--tx3)", marginBottom: 18 }}>
        {t("countLabel", { count: channels.length })}
      </p>

      <div className="ch-grid">
        {channels.map((c) => (
          <Link key={c.slug} href={`/channels/${c.slug}`} className="ch-card">
            <div className="top">
              <Icon name={platformIcon(c.platform)} />
              <span className="nm">{c.name}</span>
            </div>
            {c.audienceDesc && <div className="aud">{c.audienceDesc}</div>}
            <div className="ft">
              <span
                className="dot"
                style={{
                  background: RISK[c.defaultBanRisk as BanRiskValue].color,
                }}
                aria-hidden
              />
              {tr(c.defaultBanRisk)}
              {c.bestTime && (
                <>
                  <span style={{ color: "var(--tx3)" }}>·</span>
                  {c.bestTime}
                </>
              )}
            </div>
          </Link>
        ))}
      </div>

      <div className="gate" style={{ marginTop: 28 }}>
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
