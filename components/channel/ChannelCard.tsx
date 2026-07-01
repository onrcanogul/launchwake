import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui/Button";
import { RISK, type BanRiskValue } from "@/components/ui/risk";
import { platformIcon } from "@/components/ui/platform";

export type ChannelCardData = {
  name: string;
  platform: string;
  audienceDesc?: string | null;
  fitScore: number;
  banRisk: BanRiskValue;
  bestTime?: string | null;
  whyText: string;
  ruleNote?: string | null;
  outcomeNote?: string | null;
};

/**
 * The hero unit: one ranked channel recommendation for a ship.
 * icon + name + audience · fit meter · why · footer(ban risk, time, rule) · action.
 */
export function ChannelCard({
  data,
  draftHref,
  remindHref,
}: {
  data: ChannelCardData;
  draftHref: string;
  remindHref?: string;
}) {
  const risk = RISK[data.banRisk];
  const fit = Math.max(0, Math.min(100, data.fitScore));

  return (
    <div className="chan">
      <div className="top">
        <div className="ico">
          <Icon name={platformIcon(data.platform)} />
        </div>
        <div>
          <h3>{data.name}</h3>
          {data.audienceDesc && <div className="aud">{data.audienceDesc}</div>}
        </div>
        <div className="fit">
          <div className="fr">
            <div className="meter">
              <span style={{ width: `${fit}%` }} />
            </div>
            <span className="fn">{fit}</span>
          </div>
          <div className="fk">fit score</div>
        </div>
      </div>

      <div className="why">{data.whyText}</div>

      {data.outcomeNote && (
        <div className="evidence">
          <Icon name="results" />
          {data.outcomeNote}
        </div>
      )}

      <div className="ft">
        <div className="m">
          <Icon name="shield" /> Ban risk{" "}
          <b style={{ color: risk.color }}>{risk.label}</b>
        </div>
        {data.bestTime && (
          <div className="m">
            <Icon name="calendar" /> Best <b>{data.bestTime}</b>
          </div>
        )}
        {data.ruleNote && (
          <div className="m">
            <Icon name="rules" /> Rule <b>{data.ruleNote}</b>
          </div>
        )}
        <div className="act" style={{ display: "flex", gap: 8 }}>
          {remindHref && (
            <a className="btn btn-s" href={remindHref} download>
              <Icon name="calendar" /> Remind me
            </a>
          )}
          <Button variant="primary" href={draftHref}>
            Get draft
          </Button>
        </div>
      </div>
    </div>
  );
}
