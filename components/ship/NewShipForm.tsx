"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Icon, type IconName } from "@/components/Icon";
import { Button } from "@/components/ui/Button";
import { FieldError } from "@/components/ui/FieldError";
import { CharCounter } from "@/components/ui/CharCounter";
import { useToast } from "@/components/ui/toast";
import {
  createShipAndPlan,
  pullLatestShip,
  type CreateShipState,
} from "@/app/app/ships/actions";

type Mode = "github" | "url" | "describe";

const MODES: { key: Mode; label: string; icon: IconName }[] = [
  { key: "github", label: "From GitHub", icon: "github" },
  { key: "url", label: "Paste URL", icon: "link" },
  { key: "describe", label: "Describe", icon: "kit" },
];

const TYPES = ["LAUNCH", "FEATURE", "BLOG", "OTHER"] as const;

// The first invalid one (in this order) is focused after a failed submit.
const FIELD_ORDER = ["title", "sourceUrl", "summary"] as const;

export function NewShipForm({
  githubRepo,
  plansLeft,
}: {
  githubRepo: string | null;
  plansLeft: number | null;
}) {
  const [state, formAction, pending] = useActionState<CreateShipState, FormData>(
    createShipAndPlan,
    {},
  );
  const [mode, setMode] = useState<Mode>(githubRepo ? "github" : "describe");
  const [type, setType] = useState<(typeof TYPES)[number]>("FEATURE");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [pullMsg, setPullMsg] = useState<{ text: string; ok: boolean } | null>(
    null,
  );
  const [pullPending, startPull] = useTransition();
  const { toast } = useToast();

  const fieldErrors = state.fieldErrors ?? {};
  const fieldRefs = useRef<Record<string, HTMLElement | null>>({});

  // Focus the first invalid field after a failed submit.
  useEffect(() => {
    const errs = state.fieldErrors;
    if (!errs) return;
    const first = FIELD_ORDER.find((f) => errs[f]);
    if (first) fieldRefs.current[first]?.focus();
  }, [state]);

  const doPull = () => {
    setPullMsg(null);
    startPull(async () => {
      const res = await pullLatestShip();
      if (res.ok) {
        setType(res.type as (typeof TYPES)[number]);
        setTitle(res.title);
        setSummary(res.summary);
        setSourceUrl(res.sourceUrl);
        setPullMsg({
          text: "Pulled the latest from your repo — review and build the plan.",
          ok: true,
        });
        toast("Pulled latest from GitHub");
      } else {
        setPullMsg({ text: res.error, ok: false });
        toast(res.error, "error");
      }
    });
  };

  // Cmd/Ctrl+Enter submits from the summary textarea.
  const submitShortcut = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.currentTarget.form?.requestSubmit();
    }
  };

  return (
    <form action={formAction} className="card">
      <div className="seg" role="group" aria-label="Ship source">
        {MODES.map((m) => (
          <button
            type="button"
            key={m.key}
            className={mode === m.key ? "on" : ""}
            aria-pressed={mode === m.key}
            onClick={() => setMode(m.key)}
          >
            <Icon name={m.icon} />
            {m.label}
          </button>
        ))}
      </div>

      {mode === "github" && (
        <div style={{ marginBottom: 16 }}>
          <label className="fl">Connected repo</label>
          {githubRepo ? (
            <>
              <div className="repo-row">
                <span className="ico">
                  <Icon name="github" />
                </span>
                <span className="repo-name mono">{githubRepo}</span>
                <Button
                  type="button"
                  variant="secondary"
                  icon="refresh"
                  onClick={doPull}
                  disabled={pullPending}
                >
                  {pullPending ? "Pulling…" : "Pull latest"}
                </Button>
              </div>
              {pullMsg && (
                <div
                  className={pullMsg.ok ? "form-msg ok" : "form-msg"}
                  role="status"
                >
                  <Icon name={pullMsg.ok ? "check" : "shield"} />
                  {pullMsg.text}
                </div>
              )}
              {!pullMsg && (
                <div className="fhint">
                  LaunchWake reads the latest release/commit + your product
                  context to find the right audience.
                </div>
              )}
            </>
          ) : (
            <div className="repo-connect">
              <Icon name="github" />
              <span>
                No repo connected yet.{" "}
                <Link href="/onboarding">Connect GitHub</Link> to pull ships
                straight from your releases and commits.
              </span>
            </div>
          )}
        </div>
      )}

      <input type="hidden" name="type" value={type} />
      <label className="fl">Ship type</label>
      <div
        className="seg"
        role="group"
        aria-label="Ship type"
        style={{ marginBottom: 0 }}
      >
        {TYPES.map((t) => (
          <button
            type="button"
            key={t}
            className={type === t ? `on ty-${t.toLowerCase()}` : ""}
            aria-pressed={type === t}
            onClick={() => setType(t)}
          >
            {t.charAt(0) + t.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      <div className="fgrp">
        <label className="fl" htmlFor="ship-title">
          Title
        </label>
        <input
          id="ship-title"
          className="inp"
          name="title"
          ref={(el) => {
            fieldRefs.current.title = el;
          }}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Added Slack alerts for failed webhooks"
          autoFocus
          required
          minLength={3}
          maxLength={200}
          aria-invalid={fieldErrors.title ? true : undefined}
          aria-describedby={fieldErrors.title ? "err-title" : undefined}
        />
        <FieldError id="err-title" message={fieldErrors.title} />
      </div>

      {(mode === "url" || mode === "github") && (
        <div className="fgrp">
          <label className="fl" htmlFor="ship-source">
            Source URL <span className="opt">(optional)</span>
          </label>
          <input
            id="ship-source"
            className="inp"
            name="sourceUrl"
            ref={(el) => {
              fieldRefs.current.sourceUrl = el;
            }}
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://github.com/owner/repo/releases/tag/v1.0"
            maxLength={500}
            aria-invalid={fieldErrors.sourceUrl ? true : undefined}
            aria-describedby={fieldErrors.sourceUrl ? "err-sourceUrl" : undefined}
          />
          <FieldError id="err-sourceUrl" message={fieldErrors.sourceUrl} />
          {mode === "url" && !fieldErrors.sourceUrl && (
            <div className="fhint">
              A release, changelog entry or blog post — we read it for context.
            </div>
          )}
        </div>
      )}
      {mode === "describe" && (
        <input type="hidden" name="sourceUrl" value={sourceUrl} />
      )}

      <div className="fgrp">
        <label className="fl" htmlFor="ship-summary">
          What makes this worth sharing? <span className="opt">(optional)</span>
        </label>
        <textarea
          id="ship-summary"
          className="inp"
          name="summary"
          ref={(el) => {
            fieldRefs.current.summary = el;
          }}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          onKeyDown={submitShortcut}
          placeholder="Now Hookline pings your Slack the moment a webhook fails in prod — no more finding out from an angry customer."
          maxLength={2000}
          aria-invalid={fieldErrors.summary ? true : undefined}
          aria-describedby={fieldErrors.summary ? "err-summary" : undefined}
        />
        <CharCounter value={summary} max={2000} />
        <FieldError id="err-summary" message={fieldErrors.summary} />
      </div>

      {state.error && (
        <div className="form-alert" role="alert">
          <Icon name="shield" />
          <span>{state.error}</span>
        </div>
      )}

      {plansLeft !== null &&
        (plansLeft > 0 ? (
          <div className="fhint" style={{ marginTop: 14 }}>
            {plansLeft} of 2 distribution plans left this month on Free.{" "}
            <Link href="/app/settings" style={{ color: "var(--ac)" }}>
              Upgrade to Pro
            </Link>{" "}
            for unlimited.
          </div>
        ) : (
          <div
            className="note"
            style={{ marginTop: 14, borderColor: "var(--acb)" }}
          >
            <Icon name="target" />
            <span>
              You&apos;ve used both Free plans this month.{" "}
              <Link href="/app/settings" style={{ fontWeight: 550 }}>
                Upgrade to Pro — $29/mo
              </Link>{" "}
              for unlimited distribution plans.
            </span>
          </div>
        ))}

      <div
        style={{
          marginTop: 18,
          display: "flex",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <button
          type="submit"
          className="btn btn-p"
          disabled={pending || plansLeft === 0}
          aria-busy={pending || undefined}
        >
          {pending ? <span className="lw-spin" aria-hidden /> : <Icon name="target" />}
          {pending ? "Building plan…" : "Build distribution plan"}
        </button>
        {pending && (
          <span className="fhint" style={{ marginTop: 0 }} role="status">
            Matching channels from the catalog — usually under a minute.
          </span>
        )}
      </div>
    </form>
  );
}
