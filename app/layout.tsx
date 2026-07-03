import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { getLocale } from "next-intl/server";
import { Analytics } from "@vercel/analytics/next";
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

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // `getLocale()` reflects the active marketing locale (en/tr) and falls back to
  // the default for non-localized routes (/app, reports) — so `lang` is correct
  // everywhere without a second root layout.
  const locale = await getLocale();
  return (
    <html lang={locale} className={`${inter.variable} h-full`}>
      <body>
        {children}
        {/* First-party, cookieless page-view analytics — see which SEO pages land. */}
        <Analytics />
      </body>
    </html>
  );
}
