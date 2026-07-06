"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { platformIcon } from "@/components/ui/platform";
import { RISK, type BanRiskValue } from "@/components/ui/risk";
import { useToast } from "@/components/ui/toast";
import { RemindMenu } from "@/components/channel/RemindMenu";
import { markPosted, ensureDraft } from "@/app/app/ships/actions";
import type { LaunchStep } from "@/lib/plans";
import type { LaunchWindow, TimelineStep } from "@/lib/launchday";

type Group = { window: LaunchWindow; label: string; steps: TimelineStep<LaunchStep>[] };

export function LaunchDay({
  projectId,
  shipId,
  groups,
  emailAvailable,
  slackAvailable,
}: {
  projectId: string;
  shipId: string;
  groups: Group[];
  emailAvailable: boolean;
  slackAvailable: boolean;
}) {
  const all = groups.flatMap((g) => g.steps);
  const total = all.length;
  const done = all.filter((s) => s.rec.posted).length;
  const complete = total > 0 && done === total;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <>
      <div className="ld-progress">
        <div className="ld-progress-top">
          <span>
            <b className="num">{done}</b>
            <span className="ld-of"> / {total} posted</span>
          </span>
          {complete ? (
            <Link href={`/app/${projectId}/results`} className="btn btn-p">
              <Icon name="results" /> See results
            </Link>
          ) : (
            <span className="ld-remaining">
              {total - done} channel{total - done === 1 ? "" : "s"} to go
            </span>
          )}
        </div>
        <div className="ld-bar" aria-hidden>
          <span style={{ width: `${pct}%` }} />
        </div>
        {complete && (
          <div className="ld-done-note">
            <Icon name="check" /> Launch complete — every channel is posted. Now
            watch which ones convert.
          </div>
        )}
      </div>

      {groups.map((g) => (
        <div className="ld-group" key={g.window}>
          <div className="ld-group-hd">
            <Icon name="clock" />
            {g.label}
            <span className="ld-group-cnt">{g.steps.length}</span>
          </div>
          {g.steps.map((step) => (
            <StepRow
              key={step.rec.id}
              step={step}
              projectId={projectId}
              shipId={shipId}
              emailAvailable={emailAvailable}
              slackAvailable={slackAvailable}
            />
          ))}
        </div>
      ))}
    </>
  );
}

function StepRow({
  step,
  projectId,
  shipId,
  emailAvailable,
  slackAvailable,
}: {
  step: TimelineStep<LaunchStep>;
  projectId: string;
  shipId: string;
  emailAvailable: boolean;
  slackAvailable: boolean;
}) {
  const rec = step.rec;
  const router = useRouter();
  const { toast } = useToast();
  const [posting, startPost] = useTransition();
  const [drafting, startDraft] = useTransition();
  const [copied, setCopied] = useState<"draft" | "link" | null>(null);
  const risk = RISK[rec.banRisk as BanRiskValue];

  const copy = async (text: string, key: "draft" | "link") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
      toast(key === "link" ? "Tracked link copied" : "Draft copied");
    } catch {
      toast("Couldn't copy to clipboard", "error");
    }
  };

  const post = () =>
    startPost(async () => {
      const res = await markPosted(rec.id);
      if (res.ok) {
        router.refresh();
        toast(`Marked ${rec.channelName} as posted`);
      } else {
        toast(res.error, "error");
      }
    });

  const draft = () =>
    startDraft(async () => {
      await ensureDraft(rec.id);
      router.refresh();
      toast("Draft ready");
    });

  return (
    <div className={`ld-step${rec.posted ? " done" : ""}`}>
      <div className="ld-time">{step.timeLabel}</div>

      <div className="ld-body">
        <div className="ld-row1">
          <button
            className={`ld-check${rec.posted ? " on" : ""}`}
            onClick={post}
            disabled={posting || rec.posted}
            aria-label={rec.posted ? "Posted" : "Mark as posted"}
            title={rec.posted ? "Posted" : "Mark as posted"}
          >
            {rec.posted ? <Icon name="check" /> : posting ? "…" : null}
          </button>
          <Icon name={platformIcon(rec.platform)} className="ld-pi" />
          <div className="ld-name">
            {rec.channelName}
            {rec.audienceDesc && <span className="ld-aud">{rec.audienceDesc}</span>}
          </div>
          <span className="ld-risk">
            <span className="dot" style={{ background: risk.color }} />
            {risk.label}
          </span>
        </div>

        {rec.ruleNote && (
          <div className="ld-rule">
            <Icon name="shield" />
            {rec.ruleNote}
          </div>
        )}

        {rec.draft ? (
          <div className="ld-draft">
            <div className="ld-draft-body">{rec.draft.body}</div>
            <div className="ld-draft-actions">
              <button className="btn btn-s" onClick={() => copy(rec.draft!.body, "draft")}>
                <Icon name="copy" /> {copied === "draft" ? "Copied" : "Copy draft"}
              </button>
              <Link
                href={`/app/${projectId}/ships/${shipId}/kit?rec=${rec.id}`}
                className="btn btn-gh"
              >
                <Icon name="kit" /> Edit
              </Link>
            </div>
          </div>
        ) : (
          <div className="ld-draft empty">
            <span>No draft yet.</span>
            <button className="btn btn-s" onClick={draft} disabled={drafting}>
              <Icon name="kit" /> {drafting ? "Writing…" : "Generate draft"}
            </button>
          </div>
        )}

        <div className="ld-foot">
          {rec.posted && rec.post?.trackedUrl ? (
            <>
              <code className="mono ld-link">{rec.post.trackedUrl}</code>
              <button className="btn btn-s" onClick={() => copy(rec.post!.trackedUrl!, "link")}>
                <Icon name="link" /> {copied === "link" ? "Copied" : "Copy link"}
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-p" onClick={post} disabled={posting}>
                <Icon name="check" /> {posting ? "Marking…" : "Mark as posted"}
              </button>
              <RemindMenu
                recId={rec.id}
                icsHref={`/api/ics/${rec.id}`}
                emailAvailable={emailAvailable}
                slackAvailable={slackAvailable}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
