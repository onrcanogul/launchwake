"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/ui/toast";

/** Shows the signup-tracking snippet the user drops on their product site. */
export function TrackingSetup({ appUrl }: { appUrl: string }) {
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

  return (
    <div style={{ padding: "14px 16px" }}>
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
