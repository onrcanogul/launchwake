"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/Icon";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/toast";
import { writePitch, markPitchStatus } from "@/app/app/pitches/actions";

type Status = "DRAFT" | "SENT" | "REPLIED" | "DECLINED";

type PitchUI = { id: string; subject: string; body: string; status: Status; followUpDue: boolean };

export type PitchOppUI = {
  channelId: string;
  channelName: string;
  audienceDesc: string | null;
  url: string | null;
  rules: string | null;
  pitch: PitchUI | null;
};

const STATUS_LABEL: Record<Status, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  REPLIED: "Replied",
  DECLINED: "Passed",
};

export function NewsletterPitches({ shipId, opportunities }: { shipId: string; opportunities: PitchOppUI[] }) {
  return (
    <div className="stack-lg">
      {opportunities.map((o) => (
        <PitchCard key={o.channelId} shipId={shipId} opp={o} />
      ))}
    </div>
  );
}

function PitchCard({ shipId, opp }: { shipId: string; opp: PitchOppUI }) {
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [pitch, setPitch] = useState<PitchUI | null>(opp.pitch);
  const [subject, setSubject] = useState(opp.pitch?.subject ?? "");
  const [body, setBody] = useState(opp.pitch?.body ?? "");
  const [copied, setCopied] = useState<string | null>(null);

  const generate = (regen: boolean) =>
    start(async () => {
      const res = await writePitch(shipId, opp.channelId);
      if (res.ok) {
        setSubject(res.subject ?? "");
        setBody(res.body ?? "");
        setPitch((p) => ({
          id: p?.id ?? "new",
          subject: res.subject ?? "",
          body: res.body ?? "",
          status: p?.status ?? "DRAFT",
          followUpDue: p?.followUpDue ?? false,
        }));
        toast(regen ? "Pitch regenerated" : "Pitch drafted — review, edit, then send it yourself");
      } else {
        toast(res.error ?? "Couldn't draft the pitch", "error");
      }
    });

  const setStatus = (status: Status) =>
    start(async () => {
      if (!pitch || pitch.id === "new") return;
      setPitch({ ...pitch, status, followUpDue: false });
      try {
        await markPitchStatus(pitch.id, status);
        toast(status === "SENT" ? "Marked sent — we'll nudge a follow-up in 5 days" : `Marked ${STATUS_LABEL[status].toLowerCase()}`);
      } catch {
        toast("Couldn't update the pitch", "error");
      }
    });

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast("Couldn't copy", "error");
    }
  };

  const st = pitch?.status;

  return (
    <section className="pitch">
      <div className="pitch-head">
        <span className="pitch-ico">
          <Icon name="mail" />
        </span>
        <div className="pitch-title">
          <div className="pitch-name">
            {opp.url ? (
              <a href={opp.url} target="_blank" rel="noreferrer noopener">
                {opp.channelName}
              </a>
            ) : (
              opp.channelName
            )}
          </div>
          {opp.audienceDesc && <div className="psub">{opp.audienceDesc}</div>}
        </div>
        {st && (
          <Badge accent={st === "REPLIED"} dotColor={st === "SENT" ? "var(--warn)" : st === "REPLIED" ? "var(--ok)" : undefined}>
            {STATUS_LABEL[st]}
          </Badge>
        )}
        {pitch?.followUpDue && <Badge dotColor="var(--bad)">Follow-up due</Badge>}
      </div>

      {opp.rules && <div className="pitch-rules">{opp.rules}</div>}

      {!pitch ? (
        <div className="row-end">
          <button className="btn btn-p" disabled={pending} onClick={() => generate(false)}>
            <Icon name="mail" /> {pending ? "Drafting…" : "Write curator pitch"}
          </button>
        </div>
      ) : (
        <div className="pitch-body">
          <label className="fl">Subject</label>
          <div className="pitch-subj">
            <input className="inp" value={subject} onChange={(e) => setSubject(e.target.value)} />
            <button className="btn btn-gh" onClick={() => copy(subject, "subj")}>
              <Icon name="copy" /> {copied === "subj" ? "Copied" : "Copy"}
            </button>
          </div>

          <label className="fl">Email</label>
          <textarea className="inp pitch-textarea" value={body} onChange={(e) => setBody(e.target.value)} />

          <div className="pitch-actions">
            <button className="btn btn-s" onClick={() => copy(`Subject: ${subject}\n\n${body}`, "email")}>
              <Icon name="copy" /> {copied === "email" ? "Copied" : "Copy email"}
            </button>
            <button className="btn btn-gh" disabled={pending} onClick={() => generate(true)}>
              <Icon name="refresh" /> Regenerate
            </button>
            <span className="pitch-spacer" />
            {st === "DRAFT" && (
              <button className="btn btn-p" disabled={pending} onClick={() => setStatus("SENT")}>
                <Icon name="check" /> Mark sent
              </button>
            )}
            {st === "SENT" && (
              <>
                <button className="btn btn-s" disabled={pending} onClick={() => setStatus("REPLIED")}>
                  Replied
                </button>
                <button className="btn btn-gh" disabled={pending} onClick={() => setStatus("DECLINED")}>
                  Passed
                </button>
              </>
            )}
            {(st === "REPLIED" || st === "DECLINED") && (
              <button className="btn btn-gh" disabled={pending} onClick={() => setStatus("DRAFT")}>
                <Icon name="refresh" /> Reopen
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
