"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/ui/toast";

/**
 * Shows the GitHub Action workflow to copy — comments a distribution plan on
 * every release. The api-key is the project's webhook secret (set up above).
 */
export function ReleaseAction({ hasSecret }: { hasSecret: boolean }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const workflow = `# .github/workflows/launchwake.yml
name: LaunchWake
on:
  release:
    types: [published]
permissions:
  contents: write
  pull-requests: write
jobs:
  plan:
    runs-on: ubuntu-latest
    steps:
      - uses: onrcanogul/launchwake/action@v1
        with:
          api-key: \${{ secrets.LAUNCHWAKE_API_KEY }}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(workflow);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast("Workflow copied");
    } catch {
      toast("Couldn't copy", "error");
    }
  };

  return (
    <div style={{ padding: "14px 16px" }}>
      <p style={{ color: "var(--tx2)", fontSize: 12.5, marginBottom: 10 }}>
        Add this workflow to your repo. On every release, LaunchWake builds the
        plan and comments the link on the release — your distribution meets you
        where you ship.
      </p>
      {!hasSecret && (
        <div className="track-status warn" style={{ marginBottom: 10 }}>
          <span className="dot" style={{ background: "var(--warn)" }} />
          Generate a webhook secret above first — that&apos;s the Action&apos;s
          <code className="mono"> api-key</code>.
        </div>
      )}
      <p style={{ color: "var(--tx3)", fontSize: 11.5, marginBottom: 10 }}>
        Add your webhook secret as a repo secret named{" "}
        <code className="mono">LAUNCHWAKE_API_KEY</code> (Repo → Settings →
        Secrets → Actions).
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
        {workflow}
      </pre>
      <button className="btn btn-s" style={{ marginTop: 10 }} onClick={copy}>
        <Icon name="copy" /> {copied ? "Copied" : "Copy workflow"}
      </button>
    </div>
  );
}
