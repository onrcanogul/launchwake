"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { FieldError } from "@/components/ui/FieldError";
import { CharCounter } from "@/components/ui/CharCounter";
import { RepoPicker } from "@/components/github/RepoPicker";
import { createProject, type OnboardingState } from "@/app/onboarding/actions";
import type { GithubRepo } from "@/lib/github";

// The first invalid one (in this order) is focused after a failed submit; the
// wizard also jumps to the step that owns it.
const FIELD_ORDER = [
  "name",
  "url",
  "githubRepo",
  "description",
  "launchStage",
] as const;

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
  appConnected,
  reposError,
  installUrl,
  installationId,
}: {
  /** Repos the GitHub App installation granted (private included). */
  repos: GithubRepo[];
  /** An installation exists and its repos loaded. */
  appConnected: boolean;
  /** An installation exists but listing its repos failed. */
  reposError: boolean;
  /** GitHub App install URL (null when the App isn't configured). */
  installUrl: string | null;
  /** The connected installation id, carried onto the created project. */
  installationId: string | null;
}) {
  const [step, setStep] = useState(0);

  // Connection: pick a repo from the installation, or fill product details
  // manually. Default to manual only when there's no App to connect to at all.
  const [manual, setManual] = useState(!appConnected && !installUrl);
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

  const fieldErrors = state.fieldErrors ?? {};
  const fieldRefs = useRef<Record<string, HTMLElement | null>>({});
  const [focusField, setFocusField] = useState<string | null>(null);

  // A failed submit → jump to the step that owns the first invalid field. url /
  // githubRepo live on the manual-entry step (0), launchStage on step 1, and
  // name / description are editable on the review step (2).
  useEffect(() => {
    const errs = state.fieldErrors;
    if (!errs) return;
    const first = FIELD_ORDER.find((f) => errs[f]);
    if (!first) return;
    if (first === "url" || first === "githubRepo") {
      setManual(true);
      setStep(0);
    } else if (first === "launchStage") {
      setStep(1);
    } else {
      setStep(2);
    }
    setFocusField(first);
  }, [state]);

  // Focus once the owning step has actually rendered the input.
  useEffect(() => {
    if (!focusField) return;
    const el = fieldRefs.current[focusField];
    if (el) {
      el.focus();
      setFocusField(null);
    }
  }, [focusField, step, manual]);

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
  }

  // Step 0 is satisfied when we have a repo, or a product name (manual path).
  const canContinueConnect = selectedRepo ? true : name.trim().length > 0;
  const canContinueStage = stage !== "";

  const cta =
    stage === "LAUNCHED" ? "Analyze my first ship" : "Start my launch plan";

  const manualLink = (
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
  );

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

          {/* Connected → repo picker (private repos included). */}
          {!manual && appConnected && (
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
              ) : repos.length === 0 ? (
                <div className="repo-connect">
                  <Icon name="github" />
                  <span>
                    No repos granted yet.{" "}
                    {installUrl && <a href={installUrl}>Choose repos on GitHub</a>}{" "}
                    to pick one here.
                  </span>
                </div>
              ) : (
                <RepoPicker repos={repos} onSelect={pickRepo} autoFocus />
              )}
              {manualLink}
            </div>
          )}

          {/* Not connected → install CTA (App configured) + manual fallback. */}
          {!manual && !appConnected && (
            <div>
              {reposError && (
                <div className="form-msg" role="status" style={{ marginBottom: 12 }}>
                  <Icon name="shield" />
                  Couldn&apos;t load your repos — reconnect and try again.
                </div>
              )}
              {installUrl ? (
                <>
                  <a href={installUrl} className="btn btn-p">
                    <Icon name="github" /> Connect GitHub
                  </a>
                  <div className="fhint" style={{ marginTop: 10 }}>
                    You pick which repos to grant on GitHub. LaunchWake gets{" "}
                    <b>read-only</b> access — it never writes to your code.
                  </div>
                </>
              ) : null}
              {manualLink}
            </div>
          )}

          {manual && (
            <div>
              <label className="fl">Product name</label>
              <input
                className="inp"
                ref={(el) => {
                  fieldRefs.current.name = el;
                }}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Hookline"
                maxLength={120}
                aria-invalid={fieldErrors.name ? true : undefined}
                aria-describedby={fieldErrors.name ? "err-manual-name" : undefined}
              />
              <FieldError id="err-manual-name" message={fieldErrors.name} />

              <label className="fl" style={{ marginTop: 16 }}>
                Product URL{" "}
                <span style={{ color: "var(--tx3)", fontWeight: 400 }}>
                  (recommended)
                </span>
              </label>
              <input
                className="inp"
                ref={(el) => {
                  fieldRefs.current.url = el;
                }}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://hookline.dev"
                maxLength={500}
                aria-invalid={fieldErrors.url ? true : undefined}
                aria-describedby={fieldErrors.url ? "err-manual-url" : undefined}
              />
              <FieldError id="err-manual-url" message={fieldErrors.url} />

              <label className="fl" style={{ marginTop: 16 }}>
                GitHub repo{" "}
                <span style={{ color: "var(--tx3)", fontWeight: 400 }}>
                  (optional — owner/repo)
                </span>
              </label>
              <input
                className="inp"
                ref={(el) => {
                  fieldRefs.current.githubRepo = el;
                }}
                value={githubRepo}
                onChange={(e) => setGithubRepo(e.target.value)}
                placeholder="owner/repo"
                maxLength={200}
                aria-invalid={fieldErrors.githubRepo ? true : undefined}
                aria-describedby={
                  fieldErrors.githubRepo ? "err-manual-githubRepo" : undefined
                }
              />
              <FieldError
                id="err-manual-githubRepo"
                message={fieldErrors.githubRepo}
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
                maxLength={2000}
                aria-invalid={fieldErrors.description ? true : undefined}
                aria-describedby={
                  fieldErrors.description ? "err-manual-description" : undefined
                }
              />
              <CharCounter value={description} max={2000} />
              <FieldError
                id="err-manual-description"
                message={fieldErrors.description}
              />

              {(appConnected || installUrl) && (
                <button
                  type="button"
                  className="linklike"
                  onClick={() => setManual(false)}
                >
                  ← Back to GitHub
                </button>
              )}
            </div>
          )}

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
            <button type="button" className="btn btn-s" onClick={() => setStep(0)}>
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
            ref={(el) => {
              fieldRefs.current.name = el;
            }}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={120}
            aria-invalid={fieldErrors.name ? true : undefined}
            aria-describedby={fieldErrors.name ? "err-review-name" : undefined}
          />
          <FieldError id="err-review-name" message={fieldErrors.name} />

          <label className="fl" style={{ marginTop: 16 }}>
            What does it do?{" "}
            <span style={{ color: "var(--tx3)", fontWeight: 400 }}>
              (used to match communities)
            </span>
          </label>
          <textarea
            className="inp"
            name="description"
            ref={(el) => {
              fieldRefs.current.description = el;
            }}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
            aria-invalid={fieldErrors.description ? true : undefined}
            aria-describedby={
              fieldErrors.description ? "err-review-description" : undefined
            }
          />
          <CharCounter value={description} max={2000} />
          <FieldError id="err-review-description" message={fieldErrors.description} />

          {/* Carried from earlier steps. */}
          <input type="hidden" name="url" value={url} />
          <input type="hidden" name="githubRepo" value={githubRepo} />
          <input
            type="hidden"
            name="githubInstallationId"
            value={selectedRepo && installationId ? installationId : ""}
          />
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
