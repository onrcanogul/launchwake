"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import type { IconName } from "@/components/Icon";
import { platformIcon } from "@/components/ui/platform";
import { readinessChip } from "@/lib/accountReadiness";
import type {
  AccountReadinessBlock,
  RequirementStatus,
} from "@/lib/accountReadiness";

/** One recommended launch channel with its computed readiness block. */
export type AccountReadyChannel = {
  slug: string;
  channelName: string;
  platform: string;
  block: AccountReadinessBlock;
};

const STATUS_ICON: Record<RequirementStatus, IconName> = {
  met: "check",
  unknown: "clock",
  "at-risk": "shield",
};

/**
 * Manual "accounts ready" checklist for the launch readiness stage.
 *
 * One row per recommended launch channel that has account requirements. The
 * founder checks each off by hand as they set up / warm up that account; state
 * persists client-side (localStorage, keyed by ship) — no auto-posting or
 * account creation ever happens on their behalf (golden rule).
 */
export function AccountReadinessChecklist({
  shipId,
  channels,
}: {
  shipId: string;
  channels: AccountReadyChannel[];
}) {
  const storageKey = `lw:acct-ready:${shipId}`;
  const [ready, setReady] = useState<Record<string, boolean>>({});

  // Hydrate from localStorage after mount (initial render matches the server:
  // all unchecked), so there's no hydration mismatch.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setReady(JSON.parse(raw) as Record<string, boolean>);
    } catch {
      /* ignore malformed/blocked storage */
    }
  }, [storageKey]);

  const toggle = (slug: string) => {
    setReady((prev) => {
      const next = { ...prev, [slug]: !prev[slug] };
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* ignore blocked storage */
      }
      return next;
    });
  };

  const doneCount = channels.filter((c) => ready[c.slug]).length;

  return (
    <div className="acctlist">
      <div className="acctlist-progress">
        <b>{doneCount}</b> of <b>{channels.length}</b> account
        {channels.length === 1 ? "" : "s"} ready
      </div>

      {channels.map((c) => {
        const on = Boolean(ready[c.slug]);
        const chip = readinessChip(c.block);
        return (
          <div className={`acctlist-item ${on ? "done" : ""}`} key={c.slug}>
            <button
              type="button"
              className={`acctlist-check ${on ? "on" : ""}`}
              role="checkbox"
              aria-checked={on}
              aria-label={`Mark ${c.channelName} account as ready`}
              onClick={() => toggle(c.slug)}
            >
              {on && <Icon name="check" />}
            </button>

            <div className="acctlist-main">
              <div className="acctlist-head">
                <span className="acctlist-ico">
                  <Icon name={platformIcon(c.platform)} />
                </span>
                <b className="acctlist-name">{c.channelName}</b>
                <span className={`acct-chip ${chip.cls}`}>{chip.label}</span>
              </div>

              {c.block.badges.length > 0 && (
                <div className="acct-badges">
                  {c.block.badges.map((b) => (
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

              {c.block.leadTimeHint && (
                <div className="acct-lead">
                  <Icon name="clock" />
                  <span>{c.block.leadTimeHint}</span>
                </div>
              )}

              {c.block.warning && (
                <div className="acct-warn">
                  <Icon name="shield" />
                  <span>{c.block.warning}</span>
                </div>
              )}

              {c.block.tips.length > 0 && (
                <ul className="acct-tips">
                  {c.block.tips.map((tip, i) => (
                    <li key={i}>{tip}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
