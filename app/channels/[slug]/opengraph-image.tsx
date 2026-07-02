import { getPublicChannel } from "@/lib/publicCatalog";
import { ogCard, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";

export const runtime = "nodejs";
export const alt = "Channel rules & ban risk — LaunchWake";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

const RISK_COLOR: Record<string, string> = {
  LOW: "#3ECF8E",
  MEDIUM: "#E3B341",
  HIGH: "#F0616D",
};
const RISK_LABEL: Record<string, string> = { LOW: "Low", MEDIUM: "Medium", HIGH: "High" };

/** Per-channel card: "Can I post my startup on r/SaaS?" + ban risk. */
export default async function OgImage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const channel = await getPublicChannel(slug);
  if (!channel) {
    return ogCard({ eyebrow: "ban risk lookup", title: "Channel rules & ban risk" });
  }
  const risk = channel.defaultBanRisk;
  return ogCard({
    eyebrow: `${channel.platform} · ban risk`,
    kicker: "Rules, ban risk & the safe way to post",
    title: `Can I post my startup on ${channel.name}?`,
    stats: [
      { label: "ban risk", value: RISK_LABEL[risk] ?? risk, color: RISK_COLOR[risk] },
      ...(channel.bestTime ? [{ label: "best time", value: channel.bestTime }] : []),
    ],
    footer: "launchwake — free ban-risk lookup",
  });
}
