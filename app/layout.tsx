import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { routing } from "@/i18n/routing";
import { env } from "@/lib/env";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Resolves relative canonical/OG URLs on every page against the real origin.
  metadataBase: new URL(env.APP_URL),
  title: "LaunchWake — distribution co-pilot for founders",
  description:
    "For every ship, LaunchWake tells you where to post it, how to do it without getting banned, and what actually drove signups.",
  // Rendered only when a Search Console token is configured.
  verification: env.GOOGLE_SITE_VERIFICATION
    ? { google: env.GOOGLE_SITE_VERIFICATION }
    : undefined,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // The root layout sits in EVERY route's chain, so it must stay static: calling
  // a request API here (e.g. `getLocale()`) would opt every page out of static
  // generation and force a serverless render on each first hit. We pin `lang` to
  // the default locale; the localized `[locale]` layout re-marks its subtree with
  // the active locale (see its `lang` wrapper) so Turkish pages read correctly.
  return (
    <html lang={routing.defaultLocale} className={`${inter.variable} h-full`}>
      <body>
        {children}
        {/* First-party, cookieless page-view analytics — see which SEO pages land. */}
        <Analytics />
      </body>
    </html>
  );
}
