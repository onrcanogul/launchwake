import type { ReactNode } from "react";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { LocaleSwitcher } from "@/components/public/LocaleSwitcher";

/**
 * Chrome for the public, login-less pages (Launch Checker, Ban Risk Lookup).
 * A sticky top bar + centered column + footer — no app sidebar. Same tokens as
 * the app so the two never look like different products.
 *
 * Marketing pages pass `locale` to get translated nav + a language switcher.
 * Non-localized surfaces (public launch reports, invites) omit it and render the
 * English default with no switcher.
 */
export async function PublicShell({
  children,
  wide,
  locale,
}: {
  children: ReactNode;
  wide?: boolean;
  locale?: string;
}) {
  const t = await getTranslations({
    locale: locale ?? routing.defaultLocale,
    namespace: "Nav",
  });

  return (
    <div className="pub">
      <header className="pub-bar">
        <Link href="/" className="pub-brand">
          <Image
            src="/logo.png"
            alt="LaunchWake"
            width={22}
            height={22}
            className="pub-brand-logo"
            priority
          />
          LaunchWake
        </Link>
        <nav className="pub-nav">
          <Link href="/tools/launch-checker">{t("launchChecker")}</Link>
          <Link href="/channels">{t("channels")}</Link>
          <Link href="/state-of-developer-launches">{t("report")}</Link>
          <Link href="/pricing">{t("pricing")}</Link>
          {locale && <LocaleSwitcher current={locale} />}
          <Link href="/login" className="cta">
            {t("signIn")}
          </Link>
        </nav>
      </header>

      <main className={wide ? "pub-wrap wide" : "pub-wrap"}>{children}</main>

      <footer className="pub-foot">
        <span>{t("footerTagline")}</span>
        <span>
          <Link href="/tools/launch-checker">{t("launchChecker")}</Link>
          {" · "}
          <Link href="/channels">{t("channels")}</Link>
          {" · "}
          <Link href="/state-of-developer-launches">{t("stateOfLaunches")}</Link>
          {" · "}
          <Link href="/pricing">{t("pricing")}</Link>
          {" · "}
          <Link href="/changelog">{t("changelog")}</Link>
          {" · "}
          <Link href="/terms">{t("terms")}</Link>
          {" · "}
          <Link href="/privacy">{t("privacy")}</Link>
        </span>
      </footer>
    </div>
  );
}
