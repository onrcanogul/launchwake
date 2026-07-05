"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/ui/toast";
import { preStyle } from "@/components/settings/CodePrompt";
import {
  pixelScriptTag,
  pixelNextjsSnippet,
  pixelHtmlSnippet,
} from "@/lib/pixel";

const promptStyle: React.CSSProperties = {
  ...preStyle,
  fontFamily: "inherit",
  fontSize: 12.5,
  lineHeight: 1.65,
  whiteSpace: "pre-wrap",
};

type View = "oneliner" | "nextjs" | "html" | "prompt";

const TABS: { key: View; label: string }[] = [
  { key: "oneliner", label: "One-liner" },
  { key: "nextjs", label: "Next.js" },
  { key: "html", label: "Plain HTML" },
  { key: "prompt", label: "Prompt" },
];

/**
 * The pixel install snippet with per-stack variants. The hosted script does the
 * heavy lifting (capture lw_ref, define launchwakeSignup(), verification ping),
 * so every variant is one line — the tabs only differ in where that line goes.
 */
export function PixelSnippet({
  appUrl,
  projectId,
}: {
  appUrl: string;
  projectId: string;
}) {
  const base = appUrl.replace(/\/$/, "");
  const { toast } = useToast();
  const [view, setView] = useState<View>("oneliner");
  const [copied, setCopied] = useState(false);

  const oneLiner = pixelScriptTag(base, projectId);

  const prompt = `Add the LaunchWake attribution pixel to my web app. First detect the framework this repo uses (Next.js, Nuxt, SvelteKit, Rails, plain HTML, etc.) and fit the integration to how it already injects site-wide scripts — don't assume my stack.

1. Include this script site-wide (every page), e.g. in the root layout or <head>:
   ${oneLiner}
   In Next.js use next/script: <Script src="${base}/api/pixel/${projectId}" strategy="afterInteractive" />
2. On my signup-success page, call \`window.launchwakeSignup()\` once the signup has succeeded.

The script captures the \`lw_ref\` query parameter from LaunchWake tracked-link clicks, and launchwakeSignup() credits the signup to the channel that drove it. It also sends a one-time verification ping so LaunchWake can confirm the pixel is live.`;

  const bodies: Record<View, string> = {
    oneliner: oneLiner,
    nextjs: pixelNextjsSnippet(base, projectId),
    html: pixelHtmlSnippet(base, projectId),
    prompt,
  };
  const isPrompt = view === "prompt";
  const active = bodies[view];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(active);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast(isPrompt ? "Prompt copied" : "Snippet copied");
    } catch {
      toast("Couldn't copy to clipboard", "error");
    }
  };

  return (
    <>
      <div className="seg" style={{ marginBottom: 8 }} role="tablist" aria-label="Pixel snippet view">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={view === t.key}
            className={view === t.key ? "on" : ""}
            onClick={() => setView(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {isPrompt && (
        <p style={{ color: "var(--tx3)", fontSize: 11.5, marginBottom: 8 }}>
          Paste this into your AI coding assistant (Claude Code, Cursor, Copilot…) — it sets up the same thing from a plain description.
        </p>
      )}
      <pre className={isPrompt ? undefined : "mono"} style={isPrompt ? promptStyle : preStyle}>
        {active}
      </pre>
      <button className="btn btn-s" style={{ marginTop: 10 }} onClick={copy}>
        <Icon name="copy" /> {copied ? "Copied" : isPrompt ? "Copy prompt" : "Copy snippet"}
      </button>
    </>
  );
}
