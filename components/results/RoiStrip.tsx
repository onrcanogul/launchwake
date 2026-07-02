import { Icon } from "@/components/Icon";
import { formatMoney, type RoiSummary } from "@/lib/attribution";

/**
 * The ROI headline: effort in → clicks → signups → money out. The single most
 * persuasive line in the product — "~2h of work → 340 clicks → 41 signups → $340".
 */
export function RoiStrip({
  roi,
  topRevenueChannel,
}: {
  roi: RoiSummary;
  topRevenueChannel?: { name: string; revenueCents: number } | null;
}) {
  const hasRevenue = roi.revenueCents > 0;
  const steps: Array<{ label: string; value: string; accent?: boolean }> = [
    { label: "work", value: `~${roi.effortLabel}` },
    { label: "clicks", value: roi.clicks.toLocaleString() },
    { label: "signups", value: roi.signups.toLocaleString() },
  ];
  if (hasRevenue) {
    steps.push({
      label: roi.recurringCents > 0 ? "revenue · incl. MRR" : "revenue",
      value: formatMoney(roi.revenueCents, roi.currency),
      accent: true,
    });
  }

  return (
    <div className="roi">
      <div className="roi-flow">
        {steps.map((s, i) => (
          <div className="roi-step" key={s.label}>
            {i > 0 && <Icon name="arrowRight" className="roi-arrow" />}
            <div className={`roi-cell${s.accent ? " ac" : ""}`}>
              <div className="roi-val num">{s.value}</div>
              <div className="roi-lab">{s.label}</div>
            </div>
          </div>
        ))}
      </div>
      {hasRevenue && topRevenueChannel && (
        <div className="roi-note">
          <Icon name="results" />
          {formatMoney(topRevenueChannel.revenueCents, roi.currency)} of it came from{" "}
          <b>{topRevenueChannel.name}</b> — do more of that.
        </div>
      )}
      {!hasRevenue && roi.signups > 0 && (
        <div className="roi-note">
          <Icon name="target" />
          Connect Stripe or the revenue API in Settings to see which channel drives
          real money, not just signups.
        </div>
      )}
    </div>
  );
}
