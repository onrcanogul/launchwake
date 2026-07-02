import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui/Button";
import { RISK, type BanRiskValue } from "@/components/ui/risk";
import { platformIcon } from "@/components/ui/platform";
import { RemindMenu, type RemindProps } from "@/components/channel/RemindMenu";

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
 * Category benchmark for this channel — the paywall trigger. When `locked`, the
 * page must pass a MASKED value (the real number never reaches a Free client).
 */
export type BenchmarkCardData = {
  label: string; // "Show HN median for dev-tools"
  value: string; // "34 signups" (or masked "•• signups" when locked)
  sub: string | null; // supporting line, shown only when unlocked
  locked: boolean;
};

/**
 * The hero unit: one ranked channel recommendation for a ship.
 * icon + name + audience · fit meter · why · benchmark · footer · action.
 */
export function ChannelCard({
  data,
  draftHref,
  remind,
  benchmark,
}: {
  data: ChannelCardData;
  draftHref: string;
  remind?: RemindProps;
  benchmark?: BenchmarkCardData | null;
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

      {benchmark && (
        <div className={`bench${benchmark.locked ? " locked" : ""}`}>
          <Icon name="results" />
          <span className="bench-label">{benchmark.label}</span>
          <b className="bench-val">{benchmark.value}</b>
          {benchmark.locked ? (
            <a className="bench-lock" href="/app/settings" title="Unlock category benchmarks with Pro">
              <Icon name="lock" /> Pro
            </a>
          ) : (
            benchmark.sub && <span className="bench-sub">{benchmark.sub}</span>
          )}
        </div>
      )}

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
          {remind && <RemindMenu {...remind} />}
          <Button variant="primary" href={draftHref}>
            Get draft
          </Button>
        </div>
      </div>
    </div>
  );
}
