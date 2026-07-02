import { badgeSvg } from "@/lib/report";

/**
 * "Powered by LaunchWake" badge as an SVG image. Founders embed it on their
 * launch page / changelog via <img src="…/api/badge">; each one is a doorway
 * back into the product.
 */
export function GET() {
  return new Response(badgeSvg(), {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
