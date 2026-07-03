import { defineRouting } from "next-intl/routing";

/**
 * Locale routing for the public marketing surface only.
 *
 * `localePrefix: "as-needed"` keeps English URLs bare (`/pricing`) and only
 * prefixes non-default locales (`/tr/pricing`), so no existing indexed URL
 * breaks. The app (`/app/*`), APIs, tracked links, invites and reports live
 * OUTSIDE this segment and are never localized.
 */
export const routing = defineRouting({
  locales: ["en", "tr"],
  defaultLocale: "en",
  localePrefix: "as-needed",
  // English is the default everyone lands on. We deliberately do NOT sniff
  // `Accept-Language` to auto-redirect (a Turkish browser would otherwise be
  // bounced to `/tr`); Turkish is opt-in via the switcher or a `/tr` URL.
  localeDetection: false,
});

export type Locale = (typeof routing.locales)[number];
