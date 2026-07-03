"use client";

import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

/**
 * Minimal EN / TR text toggle for the marketing header. No flags or emoji (design
 * system) — just the locale codes. It re-navigates to the same pathname in the
 * other locale via next-intl's locale-aware router.
 */
const LABELS: Record<string, string> = { en: "EN", tr: "TR" };

export function LocaleSwitcher({ current }: { current: string }) {
  const t = useTranslations("LocaleSwitcher");
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="lang-switch" role="group" aria-label={t("ariaLabel")}>
      {routing.locales.map((locale) => (
        <button
          key={locale}
          type="button"
          className={locale === current ? "lang-opt is-active" : "lang-opt"}
          aria-current={locale === current ? "true" : undefined}
          onClick={() => router.replace(pathname, { locale })}
        >
          {LABELS[locale] ?? locale.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
