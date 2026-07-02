"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/ui/toast";
import { coachPostAction } from "@/app/app/ships/actions";
import type { CoachResult } from "@/lib/coach";

export type CoachRowData = {
  postId: string;
  channelName: string;
  shipTitle: string;
  clicks: number;
  signups: number;
  removed: boolean;
  coaching: CoachResult | null;
};

const SEV_COLOR = { high: "var(--bad)", medium: "var(--warn)", low: "var(--ok)" } as const;

export function PostCoachList({ rows, canCoach }: { rows: CoachRowData[]; canCoach: boolean }) {
  return (
    <div className="coach-list">
      {rows.map((r) => (
        <CoachRow key={r.postId} row={r} canCoach={canCoach} />
      ))}
    </div>
  );
}

function CoachRow({ row, canCoach }: { row: CoachRowData; canCoach: boolean }) {
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<CoachResult | null>(row.coaching);
  const [open, setOpen] = useState(Boolean(row.coaching));

  const run = () =>
    start(async () => {
      const res = await coachPostAction(row.postId);
      if (res.ok) {
        setResult(res.result);
        setOpen(true);
        toast("Post diagnosed");
      } else {
        toast(res.error, "error");
      }
    });

  return (
    <div className="coach-item">
      <div className="coach-head">
        <div className="coach-meta">
          <b>{row.channelName}</b>
          <span className="mono">{row.shipTitle}</span>
          <span className="coach-nums num">
            {row.clicks.toLocaleString()} clicks · {row.signups} signups
            {row.removed ? " · removed" : ""}
          </span>
        </div>
        {!canCoach ? (
          <Link href="/app/settings" className="btn btn-s">
            <Icon name="lock" /> Pro
          </Link>
        ) : result ? (
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span className="coach-score num" title="How closely it followed the playbook">
              {result.playbookScore}
            </span>
            <button className="btn btn-gh" onClick={() => setOpen((o) => !o)}>
              {open ? "Hide" : "Show"}
            </button>
            <button className="btn btn-s" disabled={pending} onClick={run}>
              <Icon name="refresh" /> {pending ? "…" : "Re-run"}
            </button>
          </div>
        ) : (
          <button className="btn btn-p" disabled={pending} onClick={run}>
            <Icon name="target" /> {pending ? "Diagnosing…" : "Diagnose"}
          </button>
        )}
      </div>

      {canCoach && result && open && (
        <div className="coach-body">
          <div className="coach-verdict">{result.verdict}</div>
          {result.diagnoses.map((d, i) => (
            <div className="coach-dx" key={i}>
              <span className="coach-dot" style={{ background: SEV_COLOR[d.severity] }} />
              <div>
                <b>{d.title}</b>
                <p>{d.detail}</p>
                <p className="coach-fix">
                  <Icon name="arrowRight" /> {d.fix}
                </p>
              </div>
            </div>
          ))}
          <div className="coach-next">
            <Icon name="target" /> <b>Next time:</b> {result.nextTime}
          </div>
        </div>
      )}
    </div>
  );
}
