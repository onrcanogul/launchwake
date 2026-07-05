"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/ui/toast";

/** Shared block styling — used by CodePrompt and the plain Stripe URL row. */
export const preStyle: React.CSSProperties = {
  background: "var(--bg2)",
  border: "1px solid var(--line)",
  borderRadius: 8,
  padding: "12px 14px",
  fontSize: 11.5,
  lineHeight: 1.6,
  color: "var(--tx2)",
  overflowX: "auto",
  whiteSpace: "pre",
};

// Prompt is prose, not code — let it wrap and read in the UI font.
const promptStyle: React.CSSProperties = {
  ...preStyle,
  fontFamily: "inherit",
  fontSize: 12.5,
  lineHeight: 1.65,
  whiteSpace: "pre-wrap",
};

/**
 * A copyable snippet with a Code / Prompt toggle. "Code" is the literal snippet
 * to paste; "Prompt" is a plain-language instruction the user can hand to an AI
 * coding assistant to set the same thing up. The copy button follows the toggle.
 */
export function CodePrompt({
  code,
  prompt,
  codeLabel,
}: {
  /** The literal snippet / YAML to copy. */
  code: string;
  /** Plain-language instruction describing what the snippet does. */
  prompt: string;
  /** What the code is, for the copy button + toast (e.g. "Workflow", "Snippet"). */
  codeLabel: string;
}) {
  const { toast } = useToast();
  const [view, setView] = useState<"code" | "prompt">("code");
  const [copied, setCopied] = useState(false);

  const isPrompt = view === "prompt";
  const active = isPrompt ? prompt : code;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(active);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast(isPrompt ? "Prompt copied" : `${codeLabel} copied`);
    } catch {
      toast("Couldn't copy to clipboard", "error");
    }
  };

  return (
    <>
      <div className="seg" style={{ marginBottom: 8 }} role="tablist" aria-label="Snippet view">
        <button
          type="button"
          role="tab"
          aria-selected={!isPrompt}
          className={isPrompt ? "" : "on"}
          onClick={() => setView("code")}
        >
          Code
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={isPrompt}
          className={isPrompt ? "on" : ""}
          onClick={() => setView("prompt")}
        >
          Prompt
        </button>
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
        <Icon name="copy" /> {copied ? "Copied" : isPrompt ? "Copy prompt" : `Copy ${codeLabel.toLowerCase()}`}
      </button>
    </>
  );
}
