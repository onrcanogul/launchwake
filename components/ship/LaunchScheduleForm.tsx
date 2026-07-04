"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/ui/toast";
import { scheduleLaunch } from "@/app/app/ships/actions";

type Method = "EMAIL" | "SLACK";

export function LaunchScheduleForm({
  shipId,
  initialDate,
  emailAvailable,
  slackAvailable,
  icsHref,
}: {
  shipId: string;
  initialDate: string | null;
  emailAvailable: boolean;
  slackAvailable: boolean;
  icsHref: string;
}) {
  const { toast } = useToast();
  const [date, setDate] = useState(initialDate ?? "");
  const methods: Method[] = [
    ...(emailAvailable ? (["EMAIL"] as const) : []),
    ...(slackAvailable ? (["SLACK"] as const) : []),
  ];
  const [method, setMethod] = useState<Method | "">(methods[0] ?? "");
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      if (!date) {
        toast("Pick a launch date", "error");
        return;
      }
      const res = await scheduleLaunch(shipId, date, method || undefined);
      if (res.ok) {
        toast(
          res.reminderSet
            ? "Launch scheduled — you'll get a reminder the day before"
            : "Launch date set",
        );
      } else {
        toast(res.error, "error");
      }
    });

  return (
    <div style={{ padding: "14px 16px" }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div>
          <label className="fl">Launch date</label>
          <input
            className="inp"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{ minWidth: 180 }}
          />
        </div>
        {methods.length > 0 && (
          <div>
            <label className="fl">Day-before reminder</label>
            <select
              className="inp"
              value={method}
              onChange={(e) => setMethod(e.target.value as Method | "")}
              style={{ minWidth: 150 }}
            >
              {methods.includes("EMAIL") && <option value="EMAIL">Email</option>}
              {methods.includes("SLACK") && <option value="SLACK">Slack</option>}
              <option value="">No reminder</option>
            </select>
          </div>
        )}
        <button className="btn btn-p" onClick={save} disabled={pending}>
          <Icon name="calendar" />
          {pending ? "Saving…" : initialDate ? "Update launch date" : "Set launch date"}
        </button>
        {initialDate && (
          <a className="btn btn-s" href={icsHref} download>
            <Icon name="calendar" /> Add schedule to calendar
          </a>
        )}
      </div>
      {methods.length === 0 && (
        <div className="fhint" style={{ marginTop: 10 }}>
          Connect email or a Slack webhook in Settings to get a day-before
          reminder. You can still set the date and export the calendar.
        </div>
      )}
    </div>
  );
}
