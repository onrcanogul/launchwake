"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/ui/toast";

type Status = { signups: number; clicks: number; lastSignupAt: Date | null };

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

/** Shows the signup-tracking snippet the user drops on their product site. */
export function TrackingSetup({
  appUrl,
  status,
}: {
  appUrl: string;
  status: Status;
}) {
  const base = appUrl.replace(/\/$/, "");
  const snippet = `<script>
(function () {
  // 1. capture lw_ref from the tracked-link click (any page)
  var p = new URLSearchParams(location.search).get('lw_ref');
  if (p) { try { localStorage.setItem('lw_ref', p); } catch (e) {} }
  // 2. call launchwakeSignup() on your signup-success page
  window.launchwakeSignup = function () {
    var r; try { r = localStorage.getItem('lw_ref'); } catch (e) {}
    if (r) navigator.sendBeacon(
      '${base}/api/track/signup',
      new Blob([JSON.stringify({ ref: r })], { type: 'application/json' })
    );
  };
})();
</script>`;

  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast("Snippet copied");
    } catch {
      toast("Couldn't copy to clipboard", "error");
    }
  };

  const statusBanner =
    status.signups > 0 ? (
      <div className="track-status ok">
        <span className="dot" style={{ background: "var(--ok)" }} />
        Receiving — <b>{status.signups}</b> signup
        {status.signups === 1 ? "" : "s"} attributed
        {status.lastSignupAt ? `, last ${ago(status.lastSignupAt)}` : ""}.
      </div>
    ) : status.clicks > 0 ? (
      <div className="track-status warn">
        <span className="dot" style={{ background: "var(--warn)" }} />
        <b>{status.clicks}</b> click{status.clicks === 1 ? "" : "s"} tracked but no
        signups yet — make sure the snippet is installed and{" "}
        <code className="mono">launchwakeSignup()</code> runs on your success page.
      </div>
    ) : (
      <div className="track-status">
        <span className="dot" style={{ background: "var(--tx3)" }} />
        No data yet — add the snippet below, then it lights up as clicks and
        signups arrive.
      </div>
    );

  return (
    <div style={{ padding: "14px 16px" }}>
      {statusBanner}
      <p style={{ color: "var(--tx2)", fontSize: 12.5, marginBottom: 10 }}>
        Add this snippet site-wide, then call{" "}
        <code className="mono" style={{ color: "var(--tx)" }}>
          launchwakeSignup()
        </code>{" "}
        on your signup-success page. Clicks are tracked without it; signups need
        it.
      </p>
      <pre
        className="mono"
        style={{
          background: "var(--bg2)",
          border: "1px solid var(--line)",
          borderRadius: 8,
          padding: "12px 14px",
          fontSize: 11.5,
          lineHeight: 1.6,
          color: "var(--tx2)",
          overflowX: "auto",
          whiteSpace: "pre",
        }}
      >
        {snippet}
      </pre>
      <button className="btn btn-s" style={{ marginTop: 10 }} onClick={copy}>
        <Icon name="copy" /> {copied ? "Copied" : "Copy snippet"}
      </button>
    </div>
  );
}
