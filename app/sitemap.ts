import type { MetadataRoute } from "next";
import { env } from "@/lib/env";
import { listPublicChannelSlugs } from "@/lib/publicCatalog";

/**
 * XML sitemap for the login-less, indexable surface: the landing page, the SEO
 * tools, and every channel "ban risk" page (the 100+ long-tail pages that are
 * the point of the catalog). Private/authed routes — /app, /report/{token},
 * /r/{code}, auth — are deliberately excluded. Cached + revalidated daily.
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

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((r) => ({
    url: `${base}${r.path}`,
    lastModified,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));

  const slugs = await listPublicChannelSlugs();
  const channelEntries: MetadataRoute.Sitemap = slugs.map((slug) => ({
    url: `${base}/channels/${slug}`,
    lastModified,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  return [...staticEntries, ...channelEntries];
}
