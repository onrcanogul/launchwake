"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/ui/toast";
import { saveSlackWebhook } from "@/app/app/settings/actions";

export function SlackConnect({ current }: { current: string | null }) {
  const { toast } = useToast();
  const [url, setUrl] = useState(current ?? "");
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      const res = await saveSlackWebhook(url);
      if (res.ok) toast(url ? "Slack webhook saved" : "Slack webhook removed");
      else toast(res.error ?? "Could not save", "error");
    });

  return (
    <div style={{ padding: "14px 16px" }}>
      <label className="fl">
        Slack incoming-webhook URL{" "}
        <span style={{ color: "var(--tx3)", fontWeight: 400 }}>
          (for reminders &amp; new-ship pings)
        </span>
      </label>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          className="inp mono"
          style={{ fontSize: 12 }}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://hooks.slack.com/services/…"
        />
        <button className="btn btn-p" onClick={save} disabled={pending}>
          <Icon name="check" /> {pending ? "Saving…" : "Save"}
        </button>
      </div>
      <div className="fhint" style={{ marginTop: 8 }}>
        Create one at api.slack.com → Incoming Webhooks. Leave empty to disable.
      </div>
    </div>
  );
}
