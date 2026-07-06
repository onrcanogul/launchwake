"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/ui/toast";
import { RepoPicker } from "@/components/github/RepoPicker";
import { saveProjectRepo } from "@/app/app/settings/actions";
import type { GithubRepo } from "@/lib/github";

/**
 * Connect a repo to the project via the GitHub App installation (private repos
 * included), or via manual owner/repo entry as a de-emphasized fallback. The
 * install/reconfigure round-trip happens on GitHub; this picks from what's
 * granted. States: connected+repos, connected+error, not-connected, empty.
 */
export function GithubConnect({
  projectId,
  currentRepo,
  connected,
  repos,
  reposError,
  installUrl,
}: {
  projectId: string;
  currentRepo: string | null;
  connected: boolean;
  repos: GithubRepo[];
  reposError: boolean;
  installUrl: string | null;
}) {
  const { toast } = useToast();
  const [repo, setRepo] = useState<string | null>(currentRepo);
  const [manual, setManual] = useState(false);
  const [manualValue, setManualValue] = useState("");
  const [pending, start] = useTransition();

  const save = (input: string, okMsg: string) =>
    start(async () => {
      const res = await saveProjectRepo(projectId, input);
      if (res.ok) {
        setRepo(res.repo ?? null);
        setManual(false);
        setManualValue("");
        toast(okMsg);
      } else {
        toast(res.error ?? "Couldn't save", "error");
      }
    });

  return (
    <div style={{ padding: "14px 16px" }}>
      {repo && (
        <div className="repo-row" style={{ marginBottom: 14 }}>
          <span className="ico">
            <Icon name="github" />
          </span>
          <span className="repo-name mono">{repo}</span>
          <button
            type="button"
            className="btn btn-gh"
            style={{ marginLeft: "auto" }}
            disabled={pending}
            onClick={() => save("", "Repo disconnected")}
          >
            Disconnect
          </button>
        </div>
      )}

      {/* Primary: pick from the installation's granted repos. */}
      {connected && !manual && !reposError && (
        <>
          {repos.length === 0 ? (
            <div className="repo-connect">
              <Icon name="github" />
              <span>
                No repos granted yet.{" "}
                {installUrl && <a href={installUrl}>Choose repos on GitHub</a>}.
              </span>
            </div>
          ) : (
            <>
              <label className="fl">
                {repo ? "Switch repository" : "Pick a repository"}
              </label>
              <RepoPicker
                repos={repos}
                onSelect={(r) => save(r.fullName, `Connected ${r.fullName}`)}
              />
            </>
          )}
          {installUrl && (
            <div className="fhint" style={{ marginTop: 8 }}>
              <a href={installUrl}>Add or remove repos on GitHub</a> · read-only
              access
            </div>
          )}
        </>
      )}

      {/* Connected but the repo list failed to load. */}
      {connected && reposError && !manual && (
        <div className="track-status warn">
          <span className="dot" style={{ background: "var(--warn)" }} />
          Couldn&apos;t load your repos.{" "}
          {installUrl && <a href={installUrl}>Reconnect on GitHub</a>}.
        </div>
      )}

      {/* Not connected → install CTA (App configured). */}
      {!connected && !manual && installUrl && (
        <>
          <a href={installUrl} className="btn btn-p">
            <Icon name="github" /> Connect GitHub
          </a>
          <div className="fhint" style={{ marginTop: 10 }}>
            Pick which repos to grant on GitHub. LaunchWake gets <b>read-only</b>{" "}
            access (contents &amp; metadata) — it never writes to your code.
          </div>
        </>
      )}

      {/* Manual fallback. */}
      {manual ? (
        <div style={{ marginTop: repo || connected || installUrl ? 12 : 0 }}>
          <label className="fl">Repository (owner/repo)</label>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              className="inp mono"
              style={{ fontSize: 12 }}
              value={manualValue}
              onChange={(e) => setManualValue(e.target.value)}
              placeholder="owner/repo"
              maxLength={200}
            />
            <button
              type="button"
              className="btn btn-p"
              disabled={pending || !manualValue.trim()}
              onClick={() => save(manualValue, "Repo connected")}
            >
              <Icon name="check" /> Save
            </button>
          </div>
          <button
            type="button"
            className="linklike"
            onClick={() => setManual(false)}
          >
            ← Back
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="linklike"
          style={{ marginTop: 10 }}
          onClick={() => setManual(true)}
        >
          Enter a public repo manually
        </button>
      )}
    </div>
  );
}
