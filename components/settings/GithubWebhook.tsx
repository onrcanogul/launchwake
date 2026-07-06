"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/ui/toast";
import { generateWebhookSecret } from "@/app/app/settings/actions";
import type { GithubStatus } from "@/lib/github";

function ago(date: Date): string {
  const secs = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 1000));
  const mins = Math.floor(secs / 60);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (days >= 1) return days === 1 ? "1 day ago" : `${days} days ago`;
  if (hours >= 1) return `${hours}h ago`;
  if (mins >= 1) return `${mins}m ago`;
  return "just now";
}

export function GithubWebhook({
  projectId,
  repo,
  webhookUrl,
  initialSecret,
  status,
}: {
  projectId: string;
  repo: string | null;
  webhookUrl: string;
  initialSecret: string | null;
  status: GithubStatus;
}) {
  const { toast } = useToast();
  const [secret, setSecret] = useState(initialSecret);
  const [pending, start] = useTransition();

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(
      () => toast(`${label} copied`),
      () => toast("Couldn't copy", "error"),
    );
  };

  const generate = () =>
    start(async () => {
      const res = await generateWebhookSecret(projectId);
      if (res.ok) {
        setSecret(res.secret);
        toast(initialSecret ? "Secret rotated" : "Secret generated");
      } else {
        toast(res.error, "error");
      }
    });

  if (!repo) {
    return (
      <div style={{ padding: "14px 16px", color: "var(--tx2)", fontSize: 12.5 }}>
        Connect a GitHub repo for this product to auto-detect ships from your
        releases and commits.
      </div>
    );
  }

  const statusBanner = status.hasSecret ? (
    status.autoShips > 0 ? (
      <div className="track-status ok">
        <span className="dot" style={{ background: "var(--ok)" }} />
        Auto-detecting — <b>{status.autoShips}</b> ship
        {status.autoShips === 1 ? "" : "s"} from GitHub
        {status.lastAt ? `, last "${status.lastTitle}" ${ago(status.lastAt)}` : ""}.
      </div>
    ) : (
      <div className="track-status warn">
        <span className="dot" style={{ background: "var(--warn)" }} />
        Secret set — waiting for the first push/release. Verify the webhook is
        added on GitHub with the URL and secret below.
      </div>
    )
  ) : (
    <div className="track-status">
      <span className="dot" style={{ background: "var(--tx3)" }} />
      Generate a secret, add the webhook on GitHub, and new ships land in your
      feed automatically.
    </div>
  );

  const Row = ({
    label,
    value,
    mono = true,
  }: {
    label: string;
    value: string;
    mono?: boolean;
  }) => (
    <div style={{ marginBottom: 12 }}>
      <label className="fl">{label}</label>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          className={mono ? "inp mono" : "inp"}
          readOnly
          value={value}
          style={{ fontSize: 12 }}
        />
        <button className="btn btn-s" onClick={() => copy(value, label)}>
          <Icon name="copy" /> Copy
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ padding: "14px 16px" }}>
      {statusBanner}
      <p style={{ color: "var(--tx2)", fontSize: 12.5, margin: "12px 0 14px" }}>
        Add a webhook on{" "}
        <span className="mono" style={{ color: "var(--tx)" }}>
          github.com/{repo}/settings/hooks
        </span>{" "}
        with these settings. Events: <b>Pushes</b> and <b>Releases</b>, content
        type <span className="mono">application/json</span>.
      </p>

      <Row label="Payload URL" value={webhookUrl} />

      <div style={{ marginBottom: 4 }}>
        <label className="fl">Secret</label>
        {secret ? (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              className="inp mono"
              readOnly
              value={secret}
              style={{ fontSize: 12 }}
            />
            <button className="btn btn-s" onClick={() => copy(secret, "Secret")}>
              <Icon name="copy" /> Copy
            </button>
            <button
              className="btn btn-gh"
              onClick={generate}
              disabled={pending}
              title="Rotate secret"
            >
              <Icon name="refresh" />
            </button>
          </div>
        ) : (
          <button className="btn btn-p" onClick={generate} disabled={pending}>
            <Icon name="shield" />
            {pending ? "Generating…" : "Generate secret"}
          </button>
        )}
      </div>
    </div>
  );
}
