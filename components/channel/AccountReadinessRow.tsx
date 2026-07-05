import { Icon } from "@/components/Icon";
import type { IconName } from "@/components/Icon";
import { readinessChip } from "@/lib/accountReadiness";
import type {
  AccountReadinessBlock,
  RequirementStatus,
} from "@/lib/accountReadiness";

/** Line icon per requirement status (no emoji — design rule). */
const STATUS_ICON: Record<RequirementStatus, IconName> = {
  met: "check",
  unknown: "clock",
  "at-risk": "shield",
};

/**
 * Compact, expandable account-readiness detail under a launch channel.
 *
 * Renders as a native <details> so it needs no client JS: a summary bar with a
 * status chip, expanding to requirement badges (met / unknown / at-risk), a
 * lead-time hint, prep tips, an at-risk ban-safety warning, and the source rule.
 */
export function AccountReadinessRow({ block }: { block: AccountReadinessBlock }) {
  const header = readinessChip(block);

  return (
    <details className="acct" open={block.atRisk}>
      <summary className="acct-sum">
        <Icon name="shield" />
        <span className="acct-title">Account readiness</span>
        <span className={`acct-chip ${header.cls}`}>{header.label}</span>
        <span className="acct-caret" aria-hidden>
          <Icon name="chevronDown" />
        </span>
      </summary>

      <div className="acct-body">
        {block.badges.length > 0 && (
          <div className="acct-badges">
            {block.badges.map((b) => (
              <span
                key={b.key}
                className={`acct-badge ${b.status}`}
                title={b.detail}
              >
                <Icon name={STATUS_ICON[b.status]} />
                {b.label}
              </span>
            ))}
          </div>
        )}

        {block.leadTimeHint && (
          <div className="acct-lead">
            <Icon name="clock" />
            <span>{block.leadTimeHint}</span>
          </div>
        )}

        {block.warning && (
          <div className="acct-warn">
            <Icon name="shield" />
            <span>{block.warning}</span>
          </div>
        )}

        {block.tips.length > 0 && (
          <ul className="acct-tips">
            {block.tips.map((tip, i) => (
              <li key={i}>{tip}</li>
            ))}
          </ul>
        )}

        <div className="acct-src">Source: {block.sourceNote}</div>
      </div>
    </details>
  );
}
