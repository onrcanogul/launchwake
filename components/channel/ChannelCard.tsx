import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui/Button";
import { RISK, type BanRiskValue } from "@/components/ui/risk";
import { platformIcon } from "@/components/ui/platform";
import { RemindMenu, type RemindProps } from "@/components/channel/RemindMenu";
import { AccountReadinessRow } from "@/components/channel/AccountReadinessRow";
import type { AccountReadinessBlock } from "@/lib/accountReadiness";
import { costBadge, type ChannelCost } from "@/lib/channelCost";

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
  /** Cost to post here; a badge renders for paid/freemium (free shows nothing). */
  cost?: ChannelCost | null;
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
  settingsHref,
  remind,
  benchmark,
  accountReadiness,
  shortform,
}: {
  data: ChannelCardData;
  draftHref: string;
  /** Project-scoped Settings link (the Pro upgrade target on locked benchmarks). */
  settingsHref: string;
  remind?: RemindProps;
  benchmark?: BenchmarkCardData | null;
  /** Launch-mode account-readiness detail; omit outside launch mode. */
  accountReadiness?: AccountReadinessBlock | null;
  /** Short-form video channel — the kit produces a video concept, not text. */
  shortform?: boolean;
}) {
  const risk = RISK[data.banRisk];
  const fit = Math.max(0, Math.min(100, data.fitScore));
  const cost = data.cost ? costBadge(data.cost) : null;

  return (
    <div className="chan">
      <div className="top">
        <div className="ico">
          <Icon name={platformIcon(data.platform)} />
        </div>
        <div>
          <h3>{data.name}</h3>
          {data.audienceDesc && <div className="aud">{data.audienceDesc}</div>}
          {cost && (
            <div className="cost-row" title={cost.title}>
              <span className="cost-badge">{cost.label}</span>
              {cost.detail && <span className="cost-note">{cost.detail}</span>}
            </div>
          )}
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
            <Link className="bench-lock" href={settingsHref} title="Unlock category benchmarks with Pro">
              <Icon name="lock" /> Pro
            </Link>
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

      {accountReadiness && <AccountReadinessRow block={accountReadiness} />}

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
          <div className="m m-rule" title={data.ruleNote}>
            <Icon name="rules" /> Rule <b>{data.ruleNote}</b>
          </div>
        )}
        <div className="act" style={{ display: "flex", gap: 8 }}>
          {remind && <RemindMenu {...remind} />}
          <Button variant="primary" href={draftHref}>
            {shortform ? "Get video concept" : "Get draft"}
          </Button>
        </div>
      </div>
    </div>
  );
}
