"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/Icon";
import { Badge } from "@/components/ui/Badge";
import { platformIcon } from "@/components/ui/platform";
import { useToast } from "@/components/ui/toast";
import { completeTask, skipTask, reopenTask } from "@/app/app/queue/actions";

type TaskStatus = "PENDING" | "DONE" | "SKIPPED";

export type QueueTaskUI = {
  id: string;
  channelName: string;
  platform: string;
  channelUrl: string | null;
  rules: string | null;
  due: string; // pre-computed label
  status: TaskStatus;
};

export type QueueGroupUI = {
  phase: string;
  label: string;
  blurb: string;
  weekLabel: string;
  tasks: QueueTaskUI[];
};

export function DistributionQueue({ groups }: { groups: QueueGroupUI[] }) {
  // Optimistic status overrides so a click feels instant.
  const [overrides, setOverrides] = useState<Record<string, TaskStatus>>({});
  const [pending, start] = useTransition();
  const { toast } = useToast();

  const statusOf = (t: QueueTaskUI): TaskStatus => overrides[t.id] ?? t.status;

  const act = (id: string, next: TaskStatus, run: (id: string) => Promise<void>, msg: string) =>
    start(async () => {
      setOverrides((o) => ({ ...o, [id]: next }));
      try {
        await run(id);
        toast(msg);
      } catch {
        setOverrides((o) => {
          const { [id]: _drop, ...rest } = o;
          void _drop;
          return rest;
        });
        toast("Couldn't update the task", "error");
      }
    });

  return (
    <div className="stack-lg">
      {groups.map((g) => {
        const done = g.tasks.filter((t) => statusOf(t) === "DONE").length;
        return (
          <section className="qgroup" key={g.phase}>
            <div className="qgroup-head">
              <Badge>{g.weekLabel}</Badge>
              <div className="qgroup-title">
                <b>{g.label}</b>
                <div className="psub">{g.blurb}</div>
              </div>
              <span className="qgroup-prog">
                {done}/{g.tasks.length} done
              </span>
            </div>

            <div className="qtasks">
              {g.tasks.map((t) => {
                const st = statusOf(t);
                return (
                  <div className={`qtask st-${st.toLowerCase()}`} key={t.id}>
                    <span className="qtask-ico">
                      <Icon name={platformIcon(t.platform)} />
                    </span>
                    <div className="qtask-main">
                      <div className="qtask-name">
                        {t.channelUrl ? (
                          <a href={t.channelUrl} target="_blank" rel="noreferrer noopener">
                            {t.channelName}
                          </a>
                        ) : (
                          t.channelName
                        )}
                      </div>
                      {t.rules && <div className="qtask-rule">{t.rules}</div>}
                    </div>
                    <span className="qtask-due">{st === "PENDING" ? t.due : st === "DONE" ? "Done" : "Skipped"}</span>
                    <div className="qtask-act">
                      {st === "PENDING" ? (
                        <>
                          <button
                            className="btn btn-s"
                            disabled={pending}
                            onClick={() => act(t.id, "DONE", completeTask, "Marked done")}
                          >
                            <Icon name="check" /> Done
                          </button>
                          <button
                            className="btn btn-gh"
                            disabled={pending}
                            onClick={() => act(t.id, "SKIPPED", skipTask, "Skipped")}
                          >
                            Skip
                          </button>
                        </>
                      ) : (
                        <button
                          className="btn btn-gh"
                          disabled={pending}
                          onClick={() => act(t.id, "PENDING", reopenTask, "Re-opened")}
                        >
                          <Icon name="refresh" /> Undo
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
