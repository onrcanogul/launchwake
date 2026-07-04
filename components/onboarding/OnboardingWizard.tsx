"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { Icon } from "@/components/Icon";
import {
  createProject,
  registerPrivateRepoInterest,
  type OnboardingState,
} from "@/app/onboarding/actions";
import type { GithubRepo } from "@/lib/github";

type LaunchStage = "PRE_LAUNCH" | "UNANNOUNCED" | "LAUNCHED";

const STAGES: { value: LaunchStage; title: string; desc: string }[] = [
  {
    value: "PRE_LAUNCH",
    title: "Not live yet",
    desc: "Still building toward a first public launch.",
  },
  {
    value: "UNANNOUNCED",
    title: "Live, but never launched",
    desc: "People can use it, but you've never done a real launch.",
  },
  {
    value: "LAUNCHED",
    title: "Already launched",
    desc: "It's had a public launch — now you ship continuously.",
  },
];

/** Derive a product name from an "owner/repo" full name. */
function repoName(fullName: string): string {
  return fullName.split("/")[1] ?? fullName;
}

export function OnboardingWizard({
  repos,
  githubConnected,
}: {
  repos: GithubRepo[];
  githubConnected: boolean;
}) {
  const [step, setStep] = useState(0);

  // Connection: either a picked GitHub repo, or manual product details.
  const hasRepos = repos.length > 0;
  const [manual, setManual] = useState(!hasRepos);
  const [repoQuery, setRepoQuery] = useState("");
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [githubRepo, setGithubRepo] = useState("");
  const [description, setDescription] = useState("");

  const [stage, setStage] = useState<LaunchStage | "">("");

  const [state, action, pending] = useActionState<OnboardingState, FormData>(
    createProject,
    {},
  );

  const filteredRepos = useMemo(() => {
    const q = repoQuery.trim().toLowerCase();
    const list = q
      ? repos.filter(
          (r) =>
            r.fullName.toLowerCase().includes(q) ||
            (r.description ?? "").toLowerCase().includes(q),
        )
      : repos;
    return list.slice(0, 8);
  }, [repos, repoQuery]);

  function pickRepo(r: GithubRepo) {
    setSelectedRepo(r.fullName);
    setGithubRepo(r.fullName);
    setName((prev) => prev || repoName(r.fullName));
    setDescription((prev) => prev || r.description || "");
    setUrl((prev) => prev || r.htmlUrl);
    setManual(false);
  }

  function clearRepo() {
    setSelectedRepo(null);
    setGithubRepo("");
    setRepoQuery("");
  }

  // Step 0 is satisfied when we have a repo, or a product name (manual path).
  const canContinueConnect = selectedRepo
    ? true
    : name.trim().length > 0;
  const canContinueStage = stage !== "";

  const cta =
    stage === "LAUNCHED" ? "Analyze my first ship" : "Start my launch plan";

  return (
    <>
      <div className="steps" aria-hidden>
        <div className={`stp ${step >= 0 ? "on" : ""}`} />
        <div className={`stp ${step >= 1 ? "on" : ""}`} />
        <div className={`stp ${step >= 2 ? "on" : ""}`} />
      </div>

      {/* ── Step 0 — Connect ─────────────────────────────── */}
      {step === 0 && (
        <div>
          <h1>Connect what you&apos;re building</h1>
          <p className="lead">
            LaunchWake turns every ship — releases, features, changelogs — into a
            distribution plan. Point it at your product to get your first one.
          </p>

          {hasRepos && !manual && (
            <div>
              <label className="fl">Your GitHub repos</label>
              {selectedRepo ? (
                <div className="conn">
                  <div className="connrow" aria-label="Selected repo">
                    <div className="ic">
                      <Icon name="github" />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <b>{selectedRepo}</b>
                      <p>{description || "No description"}</p>
                    </div>
                    <button
                      type="button"
                      className="btn btn-s"
                      style={{ marginLeft: "auto" }}
                      onClick={clearRepo}
                    >
                      Change
                    </button>
                  </div>
                </div>
              ) : (
                <div className="repo-picker">
                  <div className="repo-search">
                    <Icon name="search" />
                    <input
                      className="inp"
                      placeholder="Search your repositories…"
                      value={repoQuery}
                      onChange={(e) => setRepoQuery(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="repo-menu" role="listbox">
                    {filteredRepos.length === 0 ? (
                      <div className="repo-empty">No matching repos.</div>
                    ) : (
                      filteredRepos.map((r) => (
                        <button
                          key={r.fullName}
                          type="button"
                          className="repo-opt"
                          role="option"
                          aria-selected="false"
                          onClick={() => pickRepo(r)}
                        >
                          <Icon name="github" />
                          <span className="repo-opt-name">{r.fullName}</span>
                          {r.description && (
                            <span className="repo-opt-desc">{r.description}</span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
              <button
                type="button"
                className="linklike"
                onClick={() => {
                  setManual(true);
                  clearRepo();
                }}
              >
                Can&apos;t find it? Enter details manually
              </button>
            </div>
          )}

          {manual && (
            <div>
              {githubConnected && !hasRepos && (
                <div className="fhint" style={{ marginBottom: 12 }}>
                  No public repos found on your GitHub — enter your product
                  details below.
                </div>
              )}
              <label className="fl">Product name</label>
              <input
                className="inp"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Hookline"
              />

              <label className="fl" style={{ marginTop: 16 }}>
                Product URL{" "}
                <span style={{ color: "var(--tx3)", fontWeight: 400 }}>
                  (recommended)
                </span>
              </label>
              <input
                className="inp"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://hookline.dev"
              />

              <label className="fl" style={{ marginTop: 16 }}>
                GitHub repo{" "}
                <span style={{ color: "var(--tx3)", fontWeight: 400 }}>
                  (optional — owner/repo)
                </span>
              </label>
              <input
                className="inp"
                value={githubRepo}
                onChange={(e) => setGithubRepo(e.target.value)}
                placeholder="owner/repo"
              />

              <label className="fl" style={{ marginTop: 16 }}>
                What does it do?{" "}
                <span style={{ color: "var(--tx3)", fontWeight: 400 }}>
                  (used to match communities)
                </span>
              </label>
              <textarea
                className="inp"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A webhook testing tool for developers — capture, inspect and replay events."
              />

              {hasRepos && (
                <button
                  type="button"
                  className="linklike"
                  onClick={() => setManual(false)}
                >
                  ← Back to repo picker
                </button>
              )}
            </div>
          )}

          <PrivateRepoNote />

          <div style={{ display: "flex", gap: 9, marginTop: 22 }}>
            <button
              type="button"
              className="btn btn-p"
              disabled={!canContinueConnect}
              onClick={() => setStep(1)}
            >
              Continue <Icon name="arrowRight" />
            </button>
          </div>
        </div>
      )}

      {/* ── Step 1 — Launch stage ────────────────────────── */}
      {step === 1 && (
        <div>
          <h1>Has this product had a public launch?</h1>
          <p className="lead">
            This tailors your first-run: a guided launch plan if you haven&apos;t
            launched yet, or the every-ship growth loop if you have.
          </p>

          <div className="conn" role="radiogroup" aria-label="Launch stage">
            {STAGES.map((s) => (
              <button
                key={s.value}
                type="button"
                role="radio"
                aria-checked={stage === s.value}
                className={`connrow ${stage === s.value ? "sel" : ""}`}
                onClick={() => setStage(s.value)}
              >
                <div className="ic">
                  <Icon name={s.value === "LAUNCHED" ? "rocket" : "target"} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <b>{s.title}</b>
                  <p>{s.desc}</p>
                </div>
                {stage === s.value && (
                  <span className="chk">
                    <Icon name="check" />
                  </span>
                )}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 9, marginTop: 22 }}>
            <button
              type="button"
              className="btn btn-s"
              onClick={() => setStep(0)}
            >
              Back
            </button>
            <button
              type="button"
              className="btn btn-p"
              disabled={!canContinueStage}
              onClick={() => setStep(2)}
            >
              Continue <Icon name="arrowRight" />
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2 — Review & start ──────────────────────── */}
      {step === 2 && (
        <form action={action}>
          <h1>Review &amp; start</h1>
          <p className="lead">
            One last check. You can refine anything later in Settings.
          </p>

          <label className="fl">Product name</label>
          <input
            className="inp"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <label className="fl" style={{ marginTop: 16 }}>
            What does it do?{" "}
            <span style={{ color: "var(--tx3)", fontWeight: 400 }}>
              (used to match communities)
            </span>
          </label>
          <textarea
            className="inp"
            name="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          {/* Carried from earlier steps. */}
          <input type="hidden" name="url" value={url} />
          <input type="hidden" name="githubRepo" value={githubRepo} />
          <input type="hidden" name="launchStage" value={stage} />

          <div className="ob-summary">
            {githubRepo && (
              <span className="ob-chip">
                <Icon name="github" /> {githubRepo}
              </span>
            )}
            {url && (
              <span className="ob-chip">
                <Icon name="external" /> {url.replace(/^https?:\/\//, "")}
              </span>
            )}
            <span className="ob-chip">
              <Icon name="target" />{" "}
              {STAGES.find((s) => s.value === stage)?.title}
            </span>
          </div>

          {state.error && (
            <div className="fhint" style={{ marginTop: 10, color: "var(--bad)" }}>
              {state.error}
            </div>
          )}

          <div style={{ display: "flex", gap: 9, marginTop: 22 }}>
            <button
              type="button"
              className="btn btn-s"
              onClick={() => setStep(1)}
              disabled={pending}
            >
              Back
            </button>
            <button type="submit" className="btn btn-p" disabled={pending}>
              <Icon name="arrowRight" />
              {pending ? "Analyzing where your users are…" : cta}
            </button>
          </div>
        </form>
      )}
    </>
  );
}

/** "Private repo? Coming soon" note + one-click interest capture (Lead). */
function PrivateRepoNote() {
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="ob-private">
      <Icon name="lock" />
      <span>
        Private repo? Private support is coming via a GitHub App.{" "}
        {done ? (
          <b style={{ color: "var(--ok)" }}>We&apos;ll let you know.</b>
        ) : (
          <button
            type="button"
            className="linklike"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await registerPrivateRepoInterest();
                setDone(true);
              })
            }
          >
            Notify me
          </button>
        )}
      </span>
    </div>
  );
}
