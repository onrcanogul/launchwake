"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/toast";
import type { IntentQueryView, IntentMatchView } from "@/lib/intentQueries";
import {
  createIntentQuery,
  toggleIntentQuery,
  deleteIntentQuery,
  dismissMatch,
  saveMatch,
  generateReply,
  type IntentQueryState,
} from "@/app/app/radar/actions";

/** Relative "time ago" for a post date. Pure enough for the client. */
function ago(date: Date): string {
  const s = Math.max(0, (Date.now() - new Date(date).getTime()) / 1000);
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86_400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86_400)}d ago`;
}

function scoreTone(score: number): string {
  if (score >= 70) return "var(--ok)";
  if (score >= 50) return "var(--warn)";
  return "var(--tx3)";
}

export function IntentRadar({
  queries,
  canAdd,
  limit,
  used,
  projectName,
}: {
  queries: IntentQueryView[];
  canAdd: boolean;
  limit: number | null;
  used: number;
  projectName: string;
}) {
  const [adding, setAdding] = useState(queries.length === 0);

  return (
    <div className="stack-lg">
      {(adding || queries.length === 0) && canAdd ? (
        <QueryForm
          projectName={projectName}
          cancellable={queries.length > 0}
          onDone={() => setAdding(false)}
        />
      ) : (
        <div className="radar-addbar">
          <div className="psub num">
            <b>{used}</b>
            {limit !== null ? ` of ${limit}` : ""} watch{used === 1 && limit === null ? "" : "es"} active
            {limit !== null
              ? ` · ${limit - used} left on your plan`
              : " · unlimited on your plan"}
          </div>
          {canAdd ? (
            <Button variant="primary" icon="plus" onClick={() => setAdding(true)}>
              New watch
            </Button>
          ) : (
            <Button variant="secondary" href="/app/settings" icon="rocket">
              Upgrade for more
            </Button>
          )}
        </div>
      )}

      {queries.map((q) => (
        <QueryBlock key={q.id} query={q} />
      ))}
    </div>
  );
}

// ── The add-a-watch form ───────────────────────────────────

function QueryForm({
  projectName,
  cancellable,
  onDone,
}: {
  projectName: string;
  cancellable: boolean;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState<IntentQueryState, FormData>(
    createIntentQuery,
    {},
  );
  const { toast } = useToast();

  useEffect(() => {
    if (state.ok) {
      toast("Watch created — the radar sweeps every few hours");
      onDone();
    } else if (state.error) {
      toast(state.error, "error");
    }
  }, [state, toast, onDone]);

  return (
    <form action={formAction} className="card stack">
      <div>
        <h3 className="ph3">New intent watch</h3>
        <div className="psub">
          We&apos;ll scan Hacker News &amp; Reddit for people asking for a tool like{" "}
          {projectName}.
        </div>
      </div>

      <div className="field">
        <label className="fl">Name</label>
        <input
          className="inp"
          name="title"
          placeholder="People asking for attribution tools"
          autoFocus
          required
        />
      </div>

      <div className="field">
        <label className="fl">Topic keywords</label>
        <textarea
          className="inp"
          name="keywords"
          rows={2}
          placeholder="attribution, signups, which channel, utm — comma or line separated"
          required
        />
        <div className="fhint">A post must mention at least one, so we stay on-topic.</div>
      </div>

      <div className="field">
        <label className="fl">Intent phrases (optional)</label>
        <textarea
          className="inp"
          name="phrases"
          rows={2}
          placeholder="is there a tool that, alternative to segment, looking for a tool to"
        />
        <div className="fhint">
          Exact asks to prioritize. We also catch generic “looking for…” signals.
        </div>
      </div>

      <div className="field">
        <label className="fl">Subreddits (optional)</label>
        <input
          className="inp"
          name="subreddits"
          placeholder="SaaS, startups, Entrepreneur — blank = all of Reddit"
        />
      </div>

      <div className="row-end">
        {cancellable && (
          <Button variant="ghost" onClick={onDone} type="button">
            Cancel
          </Button>
        )}
        <button type="submit" className="btn btn-p" disabled={pending}>
          {pending ? <span className="lw-spin" aria-hidden /> : <Icon name="target" />}
          {pending ? "Creating…" : "Start watching"}
        </button>
      </div>
    </form>
  );
}

// ── One watch + its matches ────────────────────────────────

function QueryBlock({ query }: { query: IntentQueryView }) {
  const [pending, start] = useTransition();
  const [confirmDel, setConfirmDel] = useState(false);
  const { toast } = useToast();

  // A primed delete disarms itself if left alone.
  useEffect(() => {
    if (!confirmDel) return;
    const t = setTimeout(() => setConfirmDel(false), 4000);
    return () => clearTimeout(t);
  }, [confirmDel]);

  const onToggle = () =>
    start(async () => {
      await toggleIntentQuery(query.id, !query.active);
    });
  const onDelete = () =>
    start(async () => {
      await deleteIntentQuery(query.id);
      toast("Watch deleted");
    });

  return (
    <section className="radar-card stack">
      <div className="radar-qhead">
        <div>
          <div className="radar-qtitle">
            <b>{query.title}</b>
            {!query.active && <Badge>Paused</Badge>}
          </div>
          <div className="psub">
            {query.keywords.slice(0, 4).join(" · ")}
            {query.subreddits.length > 0 ? ` — r/${query.subreddits.join(", r/")}` : ""}
          </div>
        </div>
        <div className="radar-qactions">
          <Badge accent={query.matchCount > 0}>{query.matchCount} matches</Badge>
          <button
            className="btn btn-gh"
            onClick={onToggle}
            disabled={pending}
            title={query.active ? "Pause this watch" : "Resume this watch"}
          >
            <Icon name={query.active ? "clock" : "refresh"} />
            {query.active ? "Pause" : "Resume"}
          </button>
          <button
            className={confirmDel ? "btn btn-gh danger" : "btn btn-gh"}
            onClick={() => (confirmDel ? onDelete() : setConfirmDel(true))}
            disabled={pending}
            title={
              confirmDel
                ? "Click again to delete this watch and its matches"
                : "Delete this watch"
            }
          >
            <Icon name="trash" />
            {confirmDel ? "Confirm delete" : "Delete"}
          </button>
        </div>
      </div>

      {query.matches.length === 0 ? (
        <div className="radar-quiet psub">
          No matches yet. The radar sweeps every few hours — new conversations land here
          with a ready-to-edit draft reply.
        </div>
      ) : (
        <div className="stack">
          {query.matches.map((m) => (
            <MatchCard key={m.id} match={m} />
          ))}
        </div>
      )}
    </section>
  );
}

// ── One caught conversation ────────────────────────────────

function MatchCard({ match }: { match: IntentMatchView }) {
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState(match.draftBody);
  const [safety, setSafety] = useState(match.safetyNote);
  const [dismissed, setDismissed] = useState(false);
  const [copied, setCopied] = useState(false);

  if (dismissed) return null;

  const draftReply = (regen: boolean) =>
    start(async () => {
      const res = await generateReply(match.id);
      if (res.ok) {
        setDraft(res.body ?? null);
        setSafety(res.safetyNote ?? null);
        toast(regen ? "Draft regenerated" : "Draft ready — review and edit before posting");
      } else {
        toast(res.error ?? "Couldn't draft a reply", "error");
      }
    });

  const copy = async () => {
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast("Couldn't copy to clipboard", "error");
    }
  };

  const onDismiss = () =>
    start(async () => {
      setDismissed(true);
      await dismissMatch(match.id);
    });
  const onSave = () =>
    start(async () => {
      await saveMatch(match.id);
      toast("Saved");
    });

  const sourceIcon = match.source === "HN" ? "hn" : "reddit";
  const sourceLabel = match.source === "HN" ? "Hacker News" : "Reddit";

  return (
    <article className="radar-match">
      <div className="radar-match-top">
        <span className="imatch-src">
          <Icon name={sourceIcon} />
          {sourceLabel}
        </span>
        <span
          className="radar-score"
          style={{ color: scoreTone(match.score) }}
          title="Match strength (0–100)"
        >
          <span className="dot" style={{ background: scoreTone(match.score) }} aria-hidden />
          {match.score}
        </span>
        <span className="psub imatch-when">
          {match.author ? `${match.author} · ` : ""}
          {ago(match.postedAt)}
        </span>
        <a
          className="btn btn-gh radar-open"
          href={match.url}
          target="_blank"
          rel="noreferrer noopener"
        >
          Open post <Icon name="external" />
        </a>
      </div>

      <a className="radar-match-title" href={match.url} target="_blank" rel="noreferrer noopener">
        {match.title}
      </a>
      {match.excerpt && <p className="radar-excerpt">{match.excerpt}</p>}
      {match.matchReason && (
        <div className="radar-why psub">
          <Icon name="target" /> {match.matchReason}
        </div>
      )}

      {draft ? (
        <div className="radar-draft">
          <div className="radar-draft-head">
            <span className="radar-draft-label">Your draft reply</span>
            <div className="row-tight">
              <button className="btn btn-gh" onClick={() => draftReply(true)} disabled={pending}>
                <Icon name="refresh" /> Regenerate
              </button>
              <button className="btn btn-s" onClick={copy}>
                <Icon name={copied ? "check" : "copy"} /> {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
          <textarea
            className="radar-draft-edit"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={Math.min(
              14,
              Math.max(4, Math.ceil(draft.length / 90) + draft.split("\n").length),
            )}
            aria-label="Draft reply — edit before posting"
          />
          {safety && (
            <div className="note">
              <Icon name="shield" />
              <span>{safety}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="row-end">
          <button className="btn btn-gh" onClick={onSave} disabled={pending}>
            <Icon name="check" /> Save
          </button>
          <button className="btn btn-gh" onClick={onDismiss} disabled={pending}>
            Dismiss
          </button>
          <button className="btn btn-p" onClick={() => draftReply(false)} disabled={pending}>
            {pending ? <span className="lw-spin" aria-hidden /> : <Icon name="kit" />}
            {pending ? "Drafting…" : "Draft a reply"}
          </button>
        </div>
      )}

      {draft && (
        <div className="row-end radar-secondary">
          <button className="btn btn-gh" onClick={onSave} disabled={pending}>
            <Icon name="check" /> Save
          </button>
          <button className="btn btn-gh" onClick={onDismiss} disabled={pending}>
            Dismiss
          </button>
        </div>
      )}
    </article>
  );
}
