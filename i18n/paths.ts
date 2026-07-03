import { routing } from "./routing";

/**
 * Pure locale/path helpers shared by page metadata and the sitemap. Kept free of
 * any Next.js request context so they are trivially unit-testable.
 *
 * A "clean path" is the locale-less pathname of a marketing page, always leading
 * with "/" except the landing page which is "" (e.g. "", "/pricing",
 * "/channels/reddit-saas").
 */

export type Locale = (typeof routing.locales)[number];

/** Is `value` one of our supported locales? */
export function isLocale(value: unknown): value is Locale {
  return (
    typeof value === "string" &&
    (routing.locales as readonly string[]).includes(value)
  );
}

/**
 * The URL pathname for a clean path in a given locale, honouring the
 * `as-needed` prefix strategy: the default locale is bare, others are prefixed.
 *   ("", "en")            -> "/"
 *   ("", "tr")            -> "/tr"
 *   ("/pricing", "en")    -> "/pricing"
 *   ("/pricing", "tr")    -> "/tr/pricing"
 */
export function localizedPath(cleanPath: string, locale: Locale): string {
  const path = cleanPath === "/" ? "" : cleanPath;
  if (locale === routing.defaultLocale) {
    return path === "" ? "/" : path;
  }
  return `/${locale}${path}`;
}

/**
 * `alternates` for a page's metadata: a canonical pointing at the current
 * locale, plus a `languages` map (one entry per locale) with an `x-default`
 * hreflang pointing at the default locale — exactly what Google wants.
 */
export function alternatesFor(cleanPath: string, locale: Locale) {
  const languages: Record<string, string> = {};
  for (const l of routing.locales) {
    languages[l] = localizedPath(cleanPath, l);
  }
  languages["x-default"] = localizedPath(cleanPath, routing.defaultLocale);
  return {
    canonical: localizedPath(cleanPath, locale),
    languages,
  };
}
