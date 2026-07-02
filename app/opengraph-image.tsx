import { ogCard, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";

export const runtime = "nodejs";
export const alt = "LaunchWake — the distribution co-pilot for technical founders";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

/** Default OG card, inherited by every public page without its own. */
export default function OgImage() {
  return ogCard({
    eyebrow: "distribution co-pilot",
    kicker: "For founders who'd rather be coding",
    title: "Ship it. We'll make the waves.",
    footer: "launchwake — where to post, safely, tracked",
  });
}
