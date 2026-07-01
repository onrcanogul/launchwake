"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/toast";
import {
  createShipAndPlan,
  pullLatestShip,
  type CreateShipState,
} from "@/app/app/ships/actions";

type Mode = "github" | "url" | "describe";

const TYPES = ["LAUNCH", "FEATURE", "BLOG", "OTHER"] as const;

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
  const [pullMsg, setPullMsg] = useState<string | null>(null);
  const [pullPending, startPull] = useTransition();
  const { toast } = useToast();

  const doPull = () => {
    setPullMsg(null);
    startPull(async () => {
      const res = await pullLatestShip();
      if (res.ok) {
        setType(res.type as (typeof TYPES)[number]);
        setTitle(res.title);
        setSummary(res.summary);
        setSourceUrl(res.sourceUrl);
        setPullMsg("Pulled the latest from your repo — review and build the plan.");
        toast("Pulled latest from GitHub");
      } else {
        setPullMsg(res.error);
        toast(res.error, "error");
      }
    });
  };

  return (
    <form action={formAction} className="card">
      <div className="seg" role="tablist">
        <button
          type="button"
          className={mode === "github" ? "on" : ""}
          onClick={() => setMode("github")}
        >
          From GitHub
        </button>
        <button
          type="button"
          className={mode === "url" ? "on" : ""}
          onClick={() => setMode("url")}
        >
          Paste URL
        </button>
        <button
          type="button"
          className={mode === "describe" ? "on" : ""}
          onClick={() => setMode("describe")}
        >
          Describe
        </button>
      </div>

      {mode === "github" && (
        <div style={{ marginBottom: 16 }}>
          <label className="fl">Connected repo</label>
          <div style={{ display: "flex", gap: 9, alignItems: "center" }}>
            <input
              className="inp"
              readOnly
              value={githubRepo ?? "No repo connected"}
            />
            <Button
              type="button"
              variant="secondary"
              icon="refresh"
              onClick={doPull}
              disabled={!githubRepo || pullPending}
            >
              {pullPending ? "Pulling…" : "Pull latest"}
            </Button>
          </div>
          <div className="fhint">
            LaunchWake reads the latest release/commit + your product context to
            find the right audience.
          </div>
        </div>
      )}

      <input type="hidden" name="type" value={type} />
      <label className="fl">Ship type</label>
      <div className="seg" style={{ marginBottom: 16 }}>
        {TYPES.map((t) => (
          <button
            type="button"
            key={t}
            className={type === t ? "on" : ""}
            onClick={() => setType(t)}
          >
            {t.charAt(0) + t.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      <label className="fl">Title</label>
      <input
        className="inp"
        name="title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="e.g. Added Slack alerts for failed webhooks"
      />

      {(mode === "url" || mode === "github") && (
        <>
          <label className="fl" style={{ marginTop: 16 }}>
            Source URL{" "}
            <span style={{ color: "var(--tx3)", fontWeight: 400 }}>(optional)</span>
          </label>
          <input
            className="inp"
            name="sourceUrl"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://github.com/owner/repo/releases/tag/v1.0"
          />
        </>
      )}
      {mode === "describe" && (
        <input type="hidden" name="sourceUrl" value={sourceUrl} />
      )}

      <label className="fl" style={{ marginTop: 16 }}>
        What makes this worth sharing?{" "}
        <span style={{ color: "var(--tx3)", fontWeight: 400 }}>(optional)</span>
      </label>
      <textarea
        className="inp"
        name="summary"
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        placeholder="Now Hookline pings your Slack the moment a webhook fails in prod — no more finding out from an angry customer."
      />

      {pullMsg && (
        <div className="fhint" style={{ marginTop: 10, color: "var(--ac)" }}>
          {pullMsg}
        </div>
      )}
      {state.error && (
        <div className="fhint" style={{ marginTop: 10, color: "var(--bad)" }}>
          {state.error}
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
              <Link href="/app/settings" style={{ color: "var(--ac)", fontWeight: 550 }}>
                Upgrade to Pro — $29/mo
              </Link>{" "}
              for unlimited distribution plans.
            </span>
          </div>
        ))}

      <div style={{ marginTop: 18, display: "flex", gap: 9, flexWrap: "wrap" }}>
        <button
          type="submit"
          className="btn btn-p"
          disabled={pending || plansLeft === 0}
        >
          <Icon name="target" />
          {pending ? "Building plan…" : "Build distribution plan"}
        </button>
      </div>
    </form>
  );
}
