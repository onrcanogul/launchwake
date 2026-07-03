import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { alternatesFor, type Locale } from "@/i18n/paths";
import { PublicShell } from "@/components/public/PublicShell";
import { PricingCards } from "@/components/public/PricingCards";
import { Icon } from "@/components/Icon";

export async function generateMetadata(props: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: "Pricing" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: alternatesFor("/pricing", locale),
  };
}

export default async function PricingPage(props: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations("Pricing");
  const tc = await getTranslations("Common");
  const faq = t.raw("faq") as { q: string; a: string }[];

  return (
    <PublicShell wide locale={locale}>
      <div className="pub-eyebrow">
        <Icon name="target" />
        {t("eyebrow")}
      </div>
      <h1 className="pub-h1">{t("title")}</h1>
      <p className="pub-lede">{t("lede")}</p>

      <div style={{ marginTop: 30 }}>
        <PricingCards />
      </div>
      <p className="lc-hint" style={{ marginTop: 14, textAlign: "center" }}>
        {t("hint")}
      </p>

      {/* FAQ — SEO + objection handling */}
      <section className="lp-section" style={{ maxWidth: 760 }}>
        <div className="lp-kicker">{t("faqKicker")}</div>
        <h2 className="lp-h2">{t("faqTitle")}</h2>
        <div className="faq">
          {faq.map((f) => (
            <div className="faq-item" key={f.q}>
              <div className="faq-q">{f.q}</div>
              <div className="faq-a">{f.a}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="gate" style={{ marginTop: 20 }}>
        <h3>{t("gateTitle")}</h3>
        <p>{t("gateBody")}</p>
        <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
          <Link href="/tools/launch-checker" className="btn btn-p">
            <Icon name="target" /> {tc("checkMyLaunch")}
          </Link>
          <Link href="/login" className="btn btn-s">
            {tc("startFree")}
          </Link>
        </div>
      </div>
    </PublicShell>
  );
}
