import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { listPublicChannels, TAG_HUBS } from "@/lib/publicCatalog";
import { Link } from "@/i18n/navigation";
import { alternatesFor, type Locale } from "@/i18n/paths";
import { PublicShell } from "@/components/public/PublicShell";
import { Icon } from "@/components/Icon";
import { platformIcon } from "@/components/ui/platform";
import { RISK, type BanRiskValue } from "@/components/ui/risk";

// The catalog is seeded/rarely changes — cache the page and revalidate daily.
export const revalidate = 86400;

export async function generateMetadata(props: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: "Channels" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: alternatesFor("/channels", locale),
  };
}

export default async function PublicChannelsPage(props: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations("Channels");
  const tr = await getTranslations("Risk");
  const tf = await getTranslations("ForTag");
  const channels = await listPublicChannels();

  return (
    <PublicShell wide locale={locale}>
      <div className="pub-eyebrow">
        <Icon name="shield" />
        {t("eyebrow")}
      </div>
      <h1 className="pub-h1">{t("title")}</h1>
      <p className="pub-lede">{t("lede")}</p>

      {/* Curated launch guides — internal links so the hub pages are never
          orphaned and crawlers discover them from the catalog root. */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "0 0 22px" }}>
        {TAG_HUBS.map((tag) => (
          <Link
            key={tag}
            href={`/channels/for/${tag}`}
            className="btn btn-s"
            style={{ fontSize: 12.5 }}
          >
            {tf(`hubs.${tag}.title`)}
          </Link>
        ))}
      </div>

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
                style={{ background: RISK[c.banRisk as BanRiskValue].color }}
                aria-hidden
              />
              {tr(c.banRisk)} {t("banRiskSuffix")}
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
    </PublicShell>
  );
}
