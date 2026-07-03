import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { alternatesFor, type Locale } from "@/i18n/paths";
import { PublicShell } from "@/components/public/PublicShell";
import { LaunchChecker } from "@/components/public/LaunchChecker";
import { PUBLIC_FREE_RECS } from "@/lib/launchChecker";
import { PricingCards } from "@/components/public/PricingCards";
import { Icon, type IconName } from "@/components/Icon";

export async function generateMetadata(props: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: "Landing" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: alternatesFor("", locale),
  };
}

// Icons pair with the "why it's different" cards by position (copy lives in i18n).
const WHY_ICONS: IconName[] = ["where", "shield", "results"];

export default async function LandingPage(props: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations("Landing");
  const tc = await getTranslations("Common");

  const pains = t.raw("pains") as { q: string; p: string }[];
  const steps = t.raw("steps") as { t: string; h: string; p: string }[];
  const why = t.raw("why") as { h: string; p: string }[];

  return (
    <PublicShell wide locale={locale}>
      {/* ── Hero ── */}
      <section className="lp-hero">
        <div className="pub-eyebrow">
          <Icon name="wave" />
          {t("heroEyebrow")}
        </div>
        <h1 className="lp-h1">
          {t("heroTitleLead")}
          <span className="ac-word">{t("heroTitleAccent")}</span>
        </h1>
        <p className="lp-lede">{t("heroLede")}</p>

        <div className="lp-try">
          <div className="lp-try-hd">
            <Icon name="target" />
            {t("heroTryHeadline")}
          </div>
          <LaunchChecker freeCount={PUBLIC_FREE_RECS} />
        </div>
      </section>

      {/* ── Problem ── */}
      <section className="lp-section">
        <div className="lp-kicker">{t("problemKicker")}</div>
        <h2 className="lp-h2">{t("problemTitle")}</h2>
        <p className="lp-lead">{t("problemLead")}</p>
        <div className="lp-grid3">
          {pains.map((x) => (
            <div key={x.q} className="lp-card">
              <h3>{x.q}</h3>
              <p>{x.p}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="lp-section">
        <div className="lp-kicker">{t("howKicker")}</div>
        <h2 className="lp-h2">{t("howTitle")}</h2>
        <p className="lp-lead">{t("howLead")}</p>
        <div className="lp-steps">
          {steps.map((s, i) => (
            <div key={s.t} className="lp-step">
              <div className="lp-num num">{i + 1}</div>
              <div>
                <div className="lp-step-t">{s.t}</div>
                <h3>{s.h}</h3>
                <p>{s.p}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Why different ── */}
      <section className="lp-section">
        <div className="lp-kicker">{t("whyKicker")}</div>
        <h2 className="lp-h2">{t("whyTitle")}</h2>
        <div className="lp-grid3">
          {why.map((w, i) => (
            <div key={w.h} className="lp-card">
              <span className="lp-ic">
                <Icon name={WHY_ICONS[i] ?? "where"} />
              </span>
              <h3>{w.h}</h3>
              <p>{w.p}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Free tools ── */}
      <section className="lp-section">
        <div className="lp-kicker">{t("toolsKicker")}</div>
        <h2 className="lp-h2">{t("toolsTitle")}</h2>
        <div className="lp-tools">
          <Link href="/tools/launch-checker" className="lp-tool">
            <span className="lp-ic">
              <Icon name="target" />
            </span>
            <h3>{t("toolLaunchCheckerTitle")}</h3>
            <p>{t("toolLaunchCheckerDesc")}</p>
            <span className="lp-tool-go">
              {t("toolLaunchCheckerGo")} <Icon name="arrowRight" />
            </span>
          </Link>
          <Link href="/channels" className="lp-tool">
            <span className="lp-ic">
              <Icon name="shield" />
            </span>
            <h3>{t("toolBanRiskTitle")}</h3>
            <p>{t("toolBanRiskDesc")}</p>
            <span className="lp-tool-go">
              {t("toolBanRiskGo")} <Icon name="arrowRight" />
            </span>
          </Link>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section className="lp-section">
        <div className="lp-kicker">{t("pricingKicker")}</div>
        <h2 className="lp-h2">{t("pricingTitle")}</h2>
        <PricingCards />
        <p className="lc-hint" style={{ marginTop: 14 }}>
          {t("pricingHint")}
          <Link href="/pricing" style={{ color: "var(--ac)" }}>
            {t("pricingHintLink")}
          </Link>
        </p>
      </section>

      {/* ── Final ── */}
      <section className="lp-final">
        <h2 className="lp-h2">{t("finalTitle")}</h2>
        <p className="lp-lead" style={{ margin: "0 auto 22px" }}>
          {t("finalLead")}
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/tools/launch-checker" className="btn btn-p btn-lg" style={{ width: "auto" }}>
            <Icon name="target" />
            {tc("checkMyLaunch")}
          </Link>
          <Link href="/login" className="btn btn-s btn-lg" style={{ width: "auto" }}>
            {tc("signIn")}
          </Link>
        </div>
      </section>
    </PublicShell>
  );
}
