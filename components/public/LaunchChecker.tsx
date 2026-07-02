"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { platformIcon } from "@/components/ui/platform";
import { RISK, type BanRiskValue } from "@/components/ui/risk";
import type { PublicPlan, PublicRec } from "@/lib/launchChecker";

/**
 * The public Launch Checker: paste a repo → grounded mini plan. The first
 * `freeCount` recs are revealed; the rest are locked behind an email capture +
 * signup gate (the funnel). No LLM, no login. `freeCount` is passed from the
 * server so this file never imports the DB-backed lib graph.
 */
export function LaunchChecker({ freeCount }: { freeCount: number }) {
  const [repo, setRepo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<PublicPlan | null>(null);
  const [repoName, setRepoName] = useState<string | null>(null);

  async function check(e: React.FormEvent) {
    e.preventDefault();
    if (!repo.trim() || loading) return;
    setLoading(true);
    setError(null);
    setPlan(null);
    try {
      const res = await fetch("/api/public/launch-checker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo: repo.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Try again.");
        return;
      }
      setPlan(data.plan as PublicPlan);
      setRepoName(data.repo as string);
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <form className="lc-form" onSubmit={check}>
        <input
          className="lc-input mono"
          placeholder="owner/repo  or  https://github.com/owner/repo"
          value={repo}
          onChange={(e) => setRepo(e.target.value)}
          aria-label="GitHub repository"
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="submit"
          className="btn btn-p"
          disabled={loading || !repo.trim()}
        >
          {loading ? "Checking…" : "Check my launch"}
        </button>
      </form>
      <div className="lc-hint">
        Public repos only. We read the name, description and latest release — never
        your code.
      </div>
      {error && <div className="lc-error">{error}</div>}

      {plan && (
        <Results plan={plan} repoName={repoName} freeCount={freeCount} />
      )}
    </div>
  );
}

function Results({
  plan,
  repoName,
  freeCount,
}: {
  plan: PublicPlan;
  repoName: string | null;
  freeCount: number;
}) {
  const free = plan.recs.slice(0, freeCount);
  const locked = plan.recs.slice(freeCount);
  const moreCount = Math.max(0, plan.totalChannels - free.length);

  return (
    <div style={{ marginTop: 34 }}>
      <div className="phead" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.02em" }}>
            Distribution plan for {plan.project.name}
          </h2>
          <div className="psub" style={{ marginTop: 4 }}>
            {plan.ship
              ? `Based on your latest ${plan.ship.type.toLowerCase()}: “${plan.ship.title}”.`
              : "Based on your repo description."}{" "}
            Ranked from LaunchWake&apos;s catalog of {plan.totalChannels} communities.
          </div>
        </div>
      </div>

      <div className="rec-list">
        {free.map((r) => (
          <RecCard key={r.slug} rec={r} />
        ))}
        {locked.map((r, i) => (
          <LockedCard key={r.slug} rank={free.length + i + 1} />
        ))}
      </div>

      <EmailGate
        moreCount={moreCount}
        repo={repoName}
        projectName={plan.project.name}
        plan={plan}
      />
    </div>
  );
}

function RecCard({ rec }: { rec: PublicRec }) {
  const riskMeta = RISK[rec.banRisk as BanRiskValue];
  return (
    <div className="rec">
      <div className="rec-top">
        <Icon name={platformIcon(rec.platform)} className="pi" />
        <div>
          <div className="rec-name">{rec.name}</div>
          {rec.audienceDesc && <div className="rec-aud">{rec.audienceDesc}</div>}
        </div>
        <div className="rec-fit">
          <div className="meter" aria-hidden>
            <span style={{ width: `${rec.fitScore}%` }} />
          </div>
          <b>{rec.fitScore}</b>
        </div>
      </div>
      <div className="rec-why">{rec.why}</div>
      <div className="rec-meta">
        <span className="k">
          <span className="dot" style={{ background: riskMeta.color }} aria-hidden />
          <b>{riskMeta.label} ban risk</b>
        </span>
        {rec.bestTime && (
          <span className="k">
            <Icon name="clock" style={{ width: 13, height: 13, stroke: "currentColor", strokeWidth: 1.6, fill: "none" }} />
            <b>{rec.bestTime}</b>
          </span>
        )}
        <Link href={`/channels/${rec.slug}`} className="k" style={{ color: "var(--ac)" }}>
          Rules & ban risk
        </Link>
      </div>
    </div>
  );
}

function LockedCard({ rank }: { rank: number }) {
  return (
    <div className="rec locked" aria-hidden>
      <div className="rec-top">
        <Icon name="channels" className="pi" />
        <div>
          <div className="rec-name">Channel #{rank} — locked</div>
          <div className="rec-aud">Sign up to reveal</div>
        </div>
        <span className="rec-lock">
          <Icon name="lock" />
          Locked
        </span>
      </div>
      <div className="rec-why">
        A ranked channel with its fit score, ban risk and the safe way to post —
        available in the full plan.
      </div>
    </div>
  );
}

function EmailGate({
  moreCount,
  repo,
  projectName,
  plan,
}: {
  moreCount: number;
  repo: string | null;
  projectName: string;
  plan: PublicPlan;
}) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (state === "saving" || !email.trim()) return;
    setState("saving");
    setError(null);
    try {
      const res = await fetch("/api/public/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          source: "launch-checker",
          repo: repo ?? undefined,
          projectName,
          context: { recs: plan.recs.map((r) => r.slug), ship: plan.ship },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't save that. Try again.");
        setState("error");
        return;
      }
      setState("done");
    } catch {
      setError("Couldn't reach the server. Try again.");
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div className="gate">
        <h3>You&apos;re on the list — now unlock the full plan</h3>
        <p>
          Create a free account to see all {plan.totalChannels} ranked channels for{" "}
          {projectName}, generate platform-native drafts, and track which channels
          actually drive signups.
        </p>
        <div style={{ marginTop: 14 }}>
          <Link
            href={`/login?callbackUrl=${encodeURIComponent("/onboarding")}`}
            className="btn btn-p"
          >
            <Icon name="arrowRight" />
            Create free account
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="gate">
      <h3>
        Unlock the full plan{moreCount > 0 ? ` — ${moreCount} more channels` : ""}
      </h3>
      <p>
        Enter your email to save this plan. Then create a free account to reveal
        every ranked channel, generate drafts, and attribute the signups you get.
      </p>
      <form className="lc-form" onSubmit={submit} style={{ marginTop: 14 }}>
        <input
          className="lc-input"
          type="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-label="Email address"
          required
        />
        <button
          type="submit"
          className="btn btn-p"
          disabled={state === "saving" || !email.trim()}
        >
          <Icon name="mail" />
          {state === "saving" ? "Saving…" : "Email me the full plan"}
        </button>
      </form>
      {error && <div className="lc-error">{error}</div>}
    </div>
  );
}
