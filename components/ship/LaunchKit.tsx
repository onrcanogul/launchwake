"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { platformIcon } from "@/components/ui/platform";
import { useToast } from "@/components/ui/toast";
import { ensureDraft, markPosted } from "@/app/app/ships/actions";
import { checkDraft, safetyVerdict } from "@/lib/bansafety";
import type { KitRec } from "@/lib/plans";

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
  // Per-tab edits so the user can tweak and re-check before copying.
  const [edits, setEdits] = useState<Record<string, string>>({});

  const active = recs.find((r) => r.id === activeId);
  const draftBody =
    active && active.draft
      ? (edits[active.id] ?? active.draft.body)
      : "";
  const safety =
    active && active.draft
      ? checkDraft({
          body: draftBody,
          platform: active.platform,
          channelRules: active.channelRules,
        })
      : null;

  const generate = (recId: string) => {
    start(async () => {
      await ensureDraft(recId);
      router.refresh();
      toast("Draft ready");
    });
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
    } catch {
      toast("Couldn't copy to clipboard", "error");
    }
  };

  return (
    <>
      <div className="tabs">
        {recs.map((r) => (
          <button
            key={r.id}
            className={["tab", r.id === activeId ? "on" : ""].join(" ")}
            onClick={() => setActiveId(r.id)}
          >
            <Icon name={platformIcon(r.platform)} />
            {r.channelName}
            {r.post && (
              <span className="dot" style={{ background: "var(--ok)" }} />
            )}
          </button>
        ))}
      </div>

      {active && (
        <>
          <div className="draft">
            <div className="dh">
              <b>{active.channelName}</b>
              {active.draft && (
                <button className="btn btn-gh" onClick={() => copy(draftBody, "body")}>
                  <Icon name="copy" /> {copied === "body" ? "Copied" : "Copy"}
                </button>
              )}
            </div>

            {active.draft ? (
              <>
                <textarea
                  className="draft-edit"
                  value={draftBody}
                  onChange={(e) =>
                    setEdits((m) => ({ ...m, [active.id]: e.target.value }))
                  }
                  spellCheck={false}
                  aria-label="Draft — edit and re-check before posting"
                />
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
                  No draft yet for {active.channelName}. Generate a
                  platform-native draft grounded in its rules — then copy, tweak,
                  and post it yourself.
                </p>
                <button
                  className="btn btn-p"
                  disabled={pending}
                  onClick={() => generate(active.id)}
                >
                  <Icon name="kit" />
                  {pending ? "Writing draft…" : "Generate draft"}
                </button>
              </div>
            )}
          </div>

          {/* Ban-safety check — will this get removed? */}
          {safety && (
            <div
              className={`panel safety safety-${safety.worst}`}
              style={{ marginTop: 14, maxWidth: 600 }}
            >
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
          <div className="panel" style={{ marginTop: 14, maxWidth: 600 }}>
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
                  <span
                    className="badge"
                    style={{ color: "var(--ok)" }}
                  >
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
                      minWidth: 180,
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
                    <Icon name="copy" /> {copied === "link" ? "Copied" : "Copy link"}
                  </button>
                </div>
                <div className="fhint" style={{ marginTop: 8 }}>
                  Put this link in your post. Clicks are tracked; signups attribute
                  once the pixel is installed (Settings → Signup tracking).
                </div>
              </div>
            ) : (
              <div style={{ padding: "14px 16px" }}>
                <label className="fl">
                  Where did you post it?{" "}
                  <span style={{ color: "var(--tx3)", fontWeight: 400 }}>
                    (optional URL)
                  </span>
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
                <button
                  className="btn btn-p"
                  style={{ marginTop: 12 }}
                  disabled={posting}
                  onClick={() => doMarkPosted(active.id)}
                >
                  <Icon name="link" />
                  {posting ? "Creating…" : "Mark as posted & get tracked link"}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
