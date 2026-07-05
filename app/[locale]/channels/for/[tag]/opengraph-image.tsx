import { getTranslations } from "next-intl/server";
import { isTagHub, listChannelsByTag } from "@/lib/publicCatalog";
import { ogCard, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";

export const runtime = "nodejs";
export const alt = "Best channels for your launch — LaunchWake";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

/** Tag-hub card: "Best places to launch a devtool" + channel counts. */
export default async function OgImage(props: {
  params: Promise<{ locale: string; tag: string }>;
}) {
  const { locale, tag } = await props.params;
  if (!isTagHub(tag)) {
    return ogCard({ eyebrow: "launch channels", title: "Where to launch your product" });
  }
  const t = await getTranslations({ locale, namespace: "ForTag" });
  const channels = await listChannelsByTag(tag);
  const lowRisk = channels.filter((c) => c.defaultBanRisk === "LOW").length;
  return ogCard({
    eyebrow: "launch channels",
    kicker: "Ranked safest-first, with rules & ban risk",
    title: t(`hubs.${tag}.title`),
    stats: [
      { label: "channels", value: String(channels.length), color: "#3ECFB6" },
      { label: "low ban risk", value: String(lowRisk), color: "#3ECF8E" },
    ],
    footer: "launchwake — free ban-risk lookup",
  });
}
