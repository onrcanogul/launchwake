import { getComparisonChannels } from "@/lib/publicCatalog";
import { ogCard, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";

export const runtime = "nodejs";
export const alt = "Channel comparison — LaunchWake";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

const RISK_COLOR: Record<string, string> = {
  LOW: "#3ECF8E",
  MEDIUM: "#E3B341",
  HIGH: "#F0616D",
};
const RISK_LABEL: Record<string, string> = { LOW: "Low", MEDIUM: "Medium", HIGH: "High" };

/** Comparison card: "Show HN vs Product Hunt" with each side's ban risk. */
export default async function OgImage(props: {
  params: Promise<{ pair: string }>;
}) {
  const { pair } = await props.params;
  const channels = await getComparisonChannels(pair);
  if (!channels) {
    return ogCard({ eyebrow: "channel comparison", title: "Which channel fits your launch?" });
  }
  const { a, b } = channels;
  // Labels stay short (channel name only) so two stats + footer fit the card.
  const riskStat = (c: typeof a) => ({
    label: c.name,
    value: RISK_LABEL[c.defaultBanRisk] ?? c.defaultBanRisk,
    color: RISK_COLOR[c.defaultBanRisk],
  });
  return ogCard({
    eyebrow: "channel comparison · ban risk",
    kicker: "Rules, audience & ban risk, head to head",
    title: `${a.name} vs ${b.name}`,
    stats: [riskStat(a), riskStat(b)],
    footer: "launchwake — free ban-risk lookup",
  });
}
