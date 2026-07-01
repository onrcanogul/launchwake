"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/ui/toast";
import { scheduleReminder } from "@/app/app/ships/actions";

const smallIcon = { width: 13, height: 13, stroke: "currentColor", strokeWidth: 1.7, fill: "none" } as const;

export type RemindProps = {
  recId: string;
  icsHref: string;
  emailAvailable: boolean;
  slackAvailable: boolean;
};

export function RemindMenu({
  recId,
  icsHref,
  emailAvailable,
  slackAvailable,
}: RemindProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const schedule = (method: "EMAIL" | "SLACK") =>
    start(async () => {
      const res = await scheduleReminder(recId, method);
      setOpen(false);
      if (res.ok) {
        const when = new Date(res.sendAt).toLocaleString(undefined, {
          weekday: "short",
          hour: "numeric",
          minute: "2-digit",
        });
        toast(`${method === "EMAIL" ? "Email" : "Slack"} reminder set — ${when}`);
      } else {
        toast(res.error, "error");
      }
    });

  return (
    <div className="shipsw" ref={ref}>
      <button className="btn btn-s" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>
        <Icon name="calendar" /> Remind me
        <Icon name="chevronDown" style={smallIcon} />
      </button>
      {open && (
        <div className="shipsw-menu" role="menu" style={{ minWidth: 210 }}>
          {emailAvailable && (
            <button className="shipsw-item" onClick={() => schedule("EMAIL")} disabled={pending}>
              <Icon name="external" style={smallIcon} />
              <span className="t">Email me at best time</span>
            </button>
          )}
          {slackAvailable && (
            <button className="shipsw-item" onClick={() => schedule("SLACK")} disabled={pending}>
              <Icon name="external" style={smallIcon} />
              <span className="t">Slack me at best time</span>
            </button>
          )}
          <a className="shipsw-item" href={icsHref} download onClick={() => setOpen(false)}>
            <Icon name="calendar" style={smallIcon} />
            <span className="t">Add to calendar (.ics)</span>
          </a>
        </div>
      )}
    </div>
  );
}
