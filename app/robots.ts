import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

/**
 * robots.txt — crawlers may index the public marketing/SEO surface but not the
 * app, APIs, tracked-link redirector, or private launch reports (unguessable
 * tokens that must never end up in an index). Points crawlers at the sitemap.
 */
export default function robots(): MetadataRoute.Robots {
  const base = env.APP_URL.replace(/\/$/, "");
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/app/",
        "/api/",
        "/r/",
        "/report/",
        "/login",
        "/onboarding",
        "/invite/",
      ],
    },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
