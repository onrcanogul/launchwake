"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { platformIcon } from "@/components/ui/platform";
import { useToast } from "@/components/ui/toast";
import { ensureDraft, markPosted } from "@/app/app/ships/actions";
import { trackClientEvent } from "@/components/analytics/TrackView";
import { checkDraft, safetyVerdict } from "@/lib/bansafety";
import { DRAFT_TONES, type DraftTone } from "@/lib/tones";
import type { Storyboard } from "@/lib/drafts";
import type { KitRec } from "@/lib/plans";

/** Session key for unsaved per-rec draft edits (survive tab/page switches). */
const EDITS_KEY = "lw-kit-edits";

/** Short human handle for a saved take: its first few words. */
function takeLabel(body: string): string {
  const words = body.replace(/\s+/g, " ").trim().split(" ");
  return words.slice(0, 4).join(" ") + (words.length > 4 ? "…" : "");
}

/** Flatten a video concept to plain text for the "Copy shot list" button. */
function storyboardText(sb: Storyboard): string {
  const lines = [
    `HOOK (first 2s): ${sb.hook}`,
    "",
    "SHOT LIST:",
    ...sb.beats.map((b, i) => `${i + 1}. ${b.label} — ${b.detail}`),
  ];
  if (sb.onScreenText.length) {
    lines.push("", "ON-SCREEN TEXT:", ...sb.onScreenText.map((t) => `• ${t}`));
  }
  lines.push("", `SOUND: ${sb.sound}`);
  return lines.join("\n");
}

export function LaunchKit({
  recs,
  initialRecId,
}: {
  recs: KitRec[];
  initialRecId?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [posting, startPost] = useTransition();
  const [activeId, setActiveId] = useState(
    initialRecId && recs.some((r) => r.id === initialRecId)
      ? initialRecId
      : recs[0]?.id,
  );
  const [copied, setCopied] = useState<string | null>(null);
  const [postUrl, setPostUrl] = useState("");
  const [postError, setPostError] = useState<string | null>(null);
  // Per-tab edits so the user can tweak and re-check before copying. Mirrored
  // to sessionStorage so navigating away doesn't silently discard them.
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [tone, setTone] = useState<DraftTone>("founder");
  // Previous takes per rec (variants) — restore any into the editor.
  const [history, setHistory] = useState<Record<string, string[]>>({});

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(EDITS_KEY);
      if (raw) setEdits((m) => ({ ...JSON.parse(raw), ...m }));
    } catch {
      /* private mode etc. — edits just stay in-memory */
    }
  }, []);
  useEffect(() => {
    try {
      sessionStorage.setItem(EDITS_KEY, JSON.stringify(edits));
    } catch {
      /* ignore */
    }
  }, [edits]);

  // Tab strip overflow affordance: fade the edges while more tabs are hidden.
  const tabsRef = useRef<HTMLDivElement | null>(null);
  const [fade, setFade] = useState({ l: false, r: false });
  useEffect(() => {
    const el = tabsRef.current;
    if (!el) return;
    const update = () =>
      setFade({
        l: el.scrollLeft > 4,
        r: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
      });
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, []);
  useEffect(() => {
    document
      .getElementById(`kit-tab-${activeId}`)
      ?.scrollIntoView({ inline: "nearest", block: "nearest" });
  }, [activeId]);

  const active = recs.find((r) => r.id === activeId);
  // Short-form channels (TikTok/Reels/Shorts) carry a video concept alongside
  // the caption — the kit shows the shoot plan, not just a paragraph.
  const sb = active?.draft?.storyboard ?? null;
  const isShort = active?.shortform ?? false;
  const draftBody =
    active && active.draft ? (edits[active.id] ?? active.draft.body) : "";
  const edited = Boolean(
    active?.draft && edits[active.id] !== undefined &&
      edits[active.id] !== active.draft.body,
  );
  const safety =
    active && active.draft
      ? checkDraft({
          body: draftBody,
          platform: active.platform,
          channelRules: active.channelRules,
        })
      : null;

  const setEdit = (recId: string, body: string, original: string) => {
    setEdits((m) => {
      if (body === original) {
        const rest = { ...m };
        delete rest[recId];
        return rest;
      }
      return { ...m, [recId]: body };
    });
  };

  const generate = (recId: string, regenerate = false) => {
    // Keep the current body as a variant before overwriting.
    if (regenerate && active?.draft) {
      const current = edits[recId] ?? active.draft.body;
      setHistory((h) => ({
        ...h,
        [recId]: [current, ...(h[recId] ?? []).filter((b) => b !== current)].slice(0, 4),
      }));
      setEdits((m) => {
        const rest = { ...m };
        delete rest[recId];
        return rest;
      });
    }
    start(async () => {
      await ensureDraft(recId, tone);
      router.refresh();
      toast(regenerate ? `New take — ${tone} voice` : "Draft ready");
    });
  };

  // Restoring a take keeps the current text as a take too — nothing is lost.
  const restore = (recId: string, body: string) => {
    const current = edits[recId] ?? active?.draft?.body ?? "";
    setHistory((h) => ({
      ...h,
      [recId]: [
        ...(current && current !== body ? [current] : []),
        ...(h[recId] ?? []).filter((b) => b !== body && b !== current),
      ].slice(0, 4),
    }));
    setEdits((m) => ({ ...m, [recId]: body }));
  };

  const doMarkPosted = (recId: string) => {
    setPostError(null);
    startPost(async () => {
      const res = await markPosted(recId, postUrl || undefined);
      if (res.ok) {
        setPostUrl("");
        router.refresh();
        toast("Marked as posted — tracked link ready");
      } else {
        setPostError(res.error);
        toast(res.error, "error");
      }
    });
  };

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
      toast(key === "link" ? "Tracked link copied" : "Draft copied");
      // Funnel: copying the draft body is the "kit used" moment (not link copies).
      if (key === "body") void trackClientEvent("draft_copied");
    } catch {
      toast("Couldn't copy to clipboard", "error");
    }
  };

  return (
    <>
      <div
        className="tabs-wrap"
        data-fade-l={fade.l || undefined}
        data-fade-r={fade.r || undefined}
      >
        <div className="tabs" role="tablist" aria-label="Channels" ref={tabsRef}>
          {recs.map((r) => (
            <button
              key={r.id}
              id={`kit-tab-${r.id}`}
              role="tab"
              aria-selected={r.id === activeId}
              className={["tab", r.id === activeId ? "on" : ""].join(" ")}
              onClick={() => setActiveId(r.id)}
            >
              <Icon name={platformIcon(r.platform)} />
              {r.channelName}
              {r.post && (
                <span
                  className="dot"
                  style={{ background: "var(--ok)" }}
                  title="Posted"
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {active && (
        <div className="kitgrid">
          <div className="draft">
            <div className="dh">
              <div className="dh-l">
                <b>{active.channelName}</b>
                {(active.bestTime || active.ruleNote) && (
                  <span
                    className="dh-meta"
                    title={[
                      active.bestTime && `Best ${active.bestTime}`,
                      active.ruleNote,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  >
                    {active.bestTime && (
                      <>
                        <Icon name="calendar" /> {active.bestTime}
                      </>
                    )}
                    {active.bestTime && active.ruleNote && " · "}
                    {active.ruleNote}
                  </span>
                )}
              </div>
              {active.draft && (
                <div className="dh-r">
                  {edited && (
                    <span className="badge" title="Edited here — copy to use it">
                      edited
                    </span>
                  )}
                  <button
                    className="btn btn-gh"
                    onClick={() => copy(draftBody, "body")}
                  >
                    <Icon name={copied === "body" ? "check" : "copy"} />{" "}
                    {copied === "body" ? "Copied" : "Copy"}
                  </button>
                </div>
              )}
            </div>

            {active.draft ? (
              <>
                {sb && (
                  <div className="storyboard">
                    <div className="sb-head">
                      <span className="sb-title">
                        <Icon name="video" /> Video concept
                      </span>
                      <button
                        className="btn btn-gh"
                        onClick={() => copy(storyboardText(sb), "shots")}
                        title="Copy the hook, shot list and sound as a shoot plan"
                      >
                        <Icon name={copied === "shots" ? "check" : "copy"} />{" "}
                        {copied === "shots" ? "Copied" : "Copy shot list"}
                      </button>
                    </div>
                    <div className="sb-hook">
                      <span className="sb-k">Hook · first 2s</span>
                      <p>{sb.hook}</p>
                    </div>
                    <ol className="sb-shots">
                      {sb.beats.map((b, i) => (
                        <li key={i}>
                          <span className="sb-n">{i + 1}</span>
                          <div>
                            <b>{b.label}</b>
                            <span>{b.detail}</span>
                          </div>
                        </li>
                      ))}
                    </ol>
                    {sb.onScreenText.length > 0 && (
                      <div className="sb-row">
                        <span className="sb-k">On-screen text</span>
                        <div className="sb-chips">
                          {sb.onScreenText.map((t, i) => (
                            <span className="sb-chip" key={i}>
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="sb-row">
                      <span className="sb-k">Sound</span>
                      <span className="sb-sound">{sb.sound}</span>
                    </div>
                  </div>
                )}
                <div className="draft-controls">
                  <div className="tone-pick">
                    <span className="tk-label">
                      {isShort ? "Next concept:" : "Next take:"}
                    </span>
                    <div className="seg">
                      {DRAFT_TONES.map((t) => (
                        <button
                          type="button"
                          key={t.value}
                          className={tone === t.value ? "on" : ""}
                          aria-pressed={tone === t.value}
                          onClick={() => setTone(t.value)}
                          title={`${t.label} voice`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button
                    className="btn btn-s"
                    disabled={pending}
                    onClick={() => generate(active.id, true)}
                  >
                    {pending ? (
                      <span className="lw-spin" aria-hidden />
                    ) : (
                      <Icon name="refresh" />
                    )}
                    {pending
                      ? isShort
                        ? "Building…"
                        : "Writing…"
                      : isShort
                        ? "New concept"
                        : "New take"}
                  </button>
                </div>
                {sb && <span className="cap-label">Caption</span>}
                <textarea
                  className="draft-edit"
                  value={draftBody}
                  onChange={(e) =>
                    setEdit(active.id, e.target.value, active.draft!.body)
                  }
                  spellCheck={false}
                  aria-label={
                    sb
                      ? "Caption — edit and re-check before posting"
                      : "Draft — edit and re-check before posting"
                  }
                />
                {(history[active.id]?.length ?? 0) > 0 && (
                  <div className="takes">
                    <span className="tk-label">Takes:</span>
                    {history[active.id].map((body, i) => (
                      <button
                        key={i}
                        className="tk-chip"
                        onClick={() => restore(active.id, body)}
                        title={body.slice(0, 120)}
                      >
                        {takeLabel(body)}
                      </button>
                    ))}
                  </div>
                )}
                <div className="fn">
                  <Icon name="shield" />
                  <span>
                    {active.draft.safetyNote ??
                      active.ruleNote ??
                      "Post from your own account and engage genuinely."}
                  </span>
                </div>
              </>
            ) : (
              <div style={{ padding: "28px 17px", textAlign: "center" }}>
                <p
                  style={{ color: "var(--tx2)", fontSize: 12.5, marginBottom: 12 }}
                >
                  {isShort
                    ? "No video concept yet. Generate a hook, shot list, on-screen text and caption for this format — then shoot and post it yourself."
                    : "No draft yet. Generate one grounded in this channel's rules — then copy, tweak, and post it yourself."}
                </p>
                <button
                  className="btn btn-p"
                  disabled={pending}
                  onClick={() => generate(active.id)}
                >
                  {pending ? (
                    <span className="lw-spin" aria-hidden />
                  ) : (
                    <Icon name={isShort ? "video" : "kit"} />
                  )}
                  {pending
                    ? isShort
                      ? "Building concept…"
                      : "Writing draft…"
                    : isShort
                      ? "Generate video concept"
                      : "Generate draft"}
                </button>
              </div>
            )}
          </div>

          <aside className="kitside">
            {/* Ban-safety check — will this get removed? */}
            {safety && (
              <div className={`panel safety safety-${safety.worst}`}>
                <div className="ph">
                  <h2>
                    <Icon
                      name="shield"
                      style={{
                        width: 13,
                        height: 13,
                        verticalAlign: "-2px",
                        marginRight: 6,
                      }}
                    />
                    Ban-safety check
                  </h2>
                  <span className={`r safety-verdict ${safety.worst}`}>
                    {safetyVerdict(safety)}
                  </span>
                </div>
                {safety.checks.map((c, i) => (
                  <div className={`safety-row ${c.level}`} key={i}>
                    <span className="sdot" />
                    <span className="sbody">
                      <b>{c.label}</b> — {c.detail}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Tracking block — record the post + mint a tracked link */}
            <div className="panel">
              <div className="ph">
                <h2>Track this post</h2>
                <span className="r">attribute signups</span>
              </div>

              {active.post?.trackedUrl ? (
                <div style={{ padding: "14px 16px" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 9,
                      flexWrap: "wrap",
                    }}
                  >
                    <span className="badge" style={{ color: "var(--ok)" }}>
                      <span className="dot" style={{ background: "var(--ok)" }} />
                      Posted
                    </span>
                    <code
                      className="mono"
                      style={{
                        fontSize: 12,
                        color: "var(--tx2)",
                        background: "var(--bg2)",
                        border: "1px solid var(--line)",
                        borderRadius: 6,
                        padding: "5px 8px",
                        flex: 1,
                        minWidth: 140,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {active.post.trackedUrl}
                    </code>
                    <button
                      className="btn btn-s"
                      onClick={() => copy(active.post!.trackedUrl!, "link")}
                    >
                      <Icon name={copied === "link" ? "check" : "copy"} />{" "}
                      {copied === "link" ? "Copied" : "Copy link"}
                    </button>
                  </div>
                  <div className="fhint" style={{ marginTop: 8 }}>
                    Put this link in your post. Clicks are tracked; signups
                    attribute once the pixel is installed (Settings → Signup
                    tracking).
                  </div>
                </div>
              ) : (
                <div style={{ padding: "14px 16px" }}>
                  <label className="fl">
                    Where did you post it? <span className="opt">(optional URL)</span>
                  </label>
                  <input
                    className="inp"
                    value={postUrl}
                    onChange={(e) => setPostUrl(e.target.value)}
                    placeholder="https://news.ycombinator.com/item?id=…"
                  />
                  {postError && (
                    <div
                      className="fhint"
                      style={{ marginTop: 8, color: "var(--bad)" }}
                    >
                      {postError}
                    </div>
                  )}
                  {/* Primary only once there's a draft — drafting comes first. */}
                  <button
                    className={active.draft ? "btn btn-p" : "btn btn-s"}
                    style={{ marginTop: 12 }}
                    disabled={posting}
                    onClick={() => doMarkPosted(active.id)}
                  >
                    {posting ? (
                      <span className="lw-spin" aria-hidden />
                    ) : (
                      <Icon name="link" />
                    )}
                    {posting ? "Creating…" : "Mark as posted & get tracked link"}
                  </button>
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
