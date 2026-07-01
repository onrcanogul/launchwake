"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { platformIcon } from "@/components/ui/platform";
import { ensureDraft } from "@/app/app/ships/actions";
import type { KitRec } from "@/lib/plans";

export function LaunchKit({
  recs,
  initialRecId,
}: {
  recs: KitRec[];
  initialRecId?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [activeId, setActiveId] = useState(
    initialRecId && recs.some((r) => r.id === initialRecId)
      ? initialRecId
      : recs[0]?.id,
  );
  const [copied, setCopied] = useState(false);

  const active = recs.find((r) => r.id === activeId);

  const generate = (recId: string) => {
    start(async () => {
      await ensureDraft(recId);
      router.refresh();
    });
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
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
          </button>
        ))}
      </div>

      {active && (
        <div className="draft">
          <div className="dh">
            <b>{active.channelName}</b>
            {active.draft && (
              <button
                className="btn btn-gh"
                onClick={() => copy(active.draft!.body)}
              >
                <Icon name="copy" /> {copied ? "Copied" : "Copy"}
              </button>
            )}
          </div>

          {active.draft ? (
            <>
              <div className="body">{active.draft.body}</div>
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
              <p style={{ color: "var(--tx2)", fontSize: 12.5, marginBottom: 12 }}>
                No draft yet for {active.channelName}. Generate a platform-native
                draft grounded in its rules — then copy, tweak, and post it
                yourself.
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
      )}
    </>
  );
}
