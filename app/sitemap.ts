import type { MetadataRoute } from "next";
import { env } from "@/lib/env";
import { listPublicChannelSlugs } from "@/lib/publicCatalog";
import { routing } from "@/i18n/routing";
import { localizedPath } from "@/i18n/paths";

/**
 * XML sitemap for the login-less, indexable surface: the landing page, the SEO
 * tools, and every channel "ban risk" page (the 100+ long-tail pages that are
 * the point of the catalog). Each URL is emitted for both locales, cross-linked
 * with hreflang `alternates.languages`. Private/authed routes — /app,
 * /report/{token}, /r/{code}, auth — are deliberately excluded. Cached daily.
 */
export const revalidate = 86400;

const STATIC_ROUTES: {
  path: string;
  priority: number;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
}[] = [
  { path: "", priority: 1.0, changeFrequency: "weekly" },
  { path: "/channels", priority: 0.9, changeFrequency: "weekly" },
  { path: "/tools/launch-checker", priority: 0.8, changeFrequency: "monthly" },
  { path: "/state-of-developer-launches", priority: 0.8, changeFrequency: "monthly" },
  { path: "/pricing", priority: 0.6, changeFrequency: "monthly" },
  { path: "/changelog", priority: 0.5, changeFrequency: "weekly" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env.APP_URL.replace(/\/$/, "");
  const lastModified = new Date();

  // hreflang alternates for a clean path: one absolute URL per locale.
  const languagesFor = (cleanPath: string): Record<string, string> => {
    const languages: Record<string, string> = {};
    for (const locale of routing.locales) {
      languages[locale] = `${base}${localizedPath(cleanPath, locale)}`;
    }
    return languages;
  };

  // Emit an entry per (route, locale) so both language URLs are indexed, each
  // pointing at the full set of alternates.
  const entriesFor = (
    cleanPath: string,
    priority: number,
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"],
  ): MetadataRoute.Sitemap => {
    const languages = languagesFor(cleanPath);
    return routing.locales.map((locale) => ({
      url: `${base}${localizedPath(cleanPath, locale)}`,
      lastModified,
      changeFrequency,
      priority,
      alternates: { languages },
    }));
  };

  const staticEntries = STATIC_ROUTES.flatMap((r) =>
    entriesFor(r.path, r.priority, r.changeFrequency),
  );

  const slugs = await listPublicChannelSlugs();
  const channelEntries = slugs.flatMap((slug) =>
    entriesFor(`/channels/${slug}`, 0.7, "monthly"),
  );

  return [...staticEntries, ...channelEntries];
}
