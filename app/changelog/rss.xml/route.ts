import { changelogRss } from "@/lib/changelog";
import { env } from "@/lib/env";

/** RSS 2.0 feed for the changelog — for readers and SEO. */
export function GET() {
  return new Response(changelogRss(env.APP_URL), {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
