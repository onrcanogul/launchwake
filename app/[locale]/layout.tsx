import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";

/**
 * Layout for the localized marketing surface. It does NOT render <html>/<body>
 * (the single root layout owns those); it only validates the locale, pins it for
 * static rendering, and exposes messages to client components (LaunchChecker,
 * LoginForm, the language switcher).
 */

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  setRequestLocale(locale);

  // The root <html> is pinned to the default locale to stay statically
  // rendered. Re-mark this localized subtree with the active locale so Turkish
  // pages read correctly for search engines / assistive tech. `display:contents`
  // means the wrapper adds no box — zero layout impact.
  return (
    <NextIntlClientProvider>
      <div lang={locale} style={{ display: "contents" }}>
        {children}
      </div>
    </NextIntlClientProvider>
  );
}
