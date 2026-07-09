"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/ui/toast";
import { preStyle } from "@/components/settings/CodePrompt";
import {
  surveyDropInSnippet,
  surveyReactSnippet,
  surveyPromptSnippet,
} from "@/lib/pixel";

const promptStyle: React.CSSProperties = {
  ...preStyle,
  fontFamily: "inherit",
  fontSize: 12.5,
  lineHeight: 1.65,
  whiteSpace: "pre-wrap",
};

type View = "dropin" | "react" | "prompt";

const TABS: { key: View; label: string }[] = [
  { key: "dropin", label: "Drop-in" },
  { key: "react", label: "React" },
  { key: "prompt", label: "Prompt" },
];

/**
 * The "how did you hear about us?" field the customer pastes onto their signup
 * form. The hosted pixel already defines window.launchwakeSurvey(answer), so
 * every variant is just the field wired to that one call — no extra script.
 */
export function SurveySnippet() {
  const { toast } = useToast();
  const [view, setView] = useState<View>("dropin");
  const [copied, setCopied] = useState(false);

  const bodies: Record<View, string> = {
    dropin: surveyDropInSnippet(),
    react: surveyReactSnippet(),
    prompt: surveyPromptSnippet(),
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
      <div className="seg" style={{ marginBottom: 8 }} role="tablist" aria-label="Survey snippet view">
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
