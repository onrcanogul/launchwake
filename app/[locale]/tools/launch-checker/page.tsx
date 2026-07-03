import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { alternatesFor, type Locale } from "@/i18n/paths";
import { PublicShell } from "@/components/public/PublicShell";
import { LaunchChecker } from "@/components/public/LaunchChecker";
import { PUBLIC_FREE_RECS } from "@/lib/launchChecker";
import { Icon } from "@/components/Icon";

export async function generateMetadata(props: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: "LaunchCheckerPage" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: alternatesFor("/tools/launch-checker", locale),
  };
}

export default async function LaunchCheckerPage(props: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations("LaunchCheckerPage");

  return (
    <PublicShell locale={locale}>
      <div className="pub-eyebrow">
        <Icon name="target" />
        {t("eyebrow")}
      </div>
      <h1 className="pub-h1">{t("title")}</h1>
      <p className="pub-lede">{t("lede")}</p>

      <LaunchChecker freeCount={PUBLIC_FREE_RECS} />
    </PublicShell>
  );
}
