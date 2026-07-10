"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
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
  const t = useTranslations("LaunchChecker");
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
        setError(data.error ?? t("errorGeneric"));
        return;
      }
      setPlan(data.plan as PublicPlan);
      setRepoName(data.repo as string);
    } catch {
      setError(t("errorNetwork"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <form className="lc-form" onSubmit={check}>
        <input
          className="lc-input mono"
          placeholder={t("inputPlaceholder")}
          value={repo}
          onChange={(e) => setRepo(e.target.value)}
          aria-label={t("inputAria")}
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="submit"
          className="btn btn-p"
          disabled={loading || !repo.trim()}
        >
          {loading ? t("submitLoading") : t("submit")}
        </button>
      </form>
      <div className="lc-hint">{t("hint")}</div>
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
  const t = useTranslations("LaunchChecker");
  const free = plan.recs.slice(0, freeCount);
  const locked = plan.recs.slice(freeCount);
  const moreCount = Math.max(0, plan.totalChannels - free.length);

  return (
    <div style={{ marginTop: 34 }}>
      <div className="phead" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.02em" }}>
            {t("planHeading", { name: plan.project.name })}
          </h2>
          <div className="psub" style={{ marginTop: 4 }}>
            {plan.ship
              ? t("basedOnShip", {
                  type: plan.ship.type.toLowerCase(),
                  title: plan.ship.title,
                })
              : t("basedOnRepo")}{" "}
            {t("rankedFrom", { count: plan.totalChannels })}
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

      {plan.thinContext && (
        <div className="lc-thin" role="note">
          <Icon name="rules" />
          <span>{t("thinNote")}</span>
        </div>
      )}

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
  const t = useTranslations("LaunchChecker");
  const tr = useTranslations("Risk");
  const riskValue = rec.banRisk as BanRiskValue;
  const riskMeta = RISK[riskValue];
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
      {rec.ruleHighlight && (
        <div className="rec-rule">
          <Icon name="shield" />
          <span>
            <b>{t("ruleHeadsUp")}</b> {rec.ruleHighlight}
          </span>
        </div>
      )}
      <div className="rec-meta">
        <span className="k">
          <span className="dot" style={{ background: riskMeta.color }} aria-hidden />
          <b>
            {tr(riskValue)} {t("banRiskSuffix")}
          </b>
        </span>
        {rec.bestTime && (
          <span className="k">
            <Icon name="clock" style={{ width: 13, height: 13, stroke: "currentColor", strokeWidth: 1.6, fill: "none" }} />
            <b>{rec.bestTime}</b>
          </span>
        )}
        <Link href={`/channels/${rec.slug}`} className="k" style={{ color: "var(--ac)" }}>
          {t("rulesLink")}
        </Link>
      </div>
    </div>
  );
}

function LockedCard({ rank }: { rank: number }) {
  const t = useTranslations("LaunchChecker");
  return (
    <div className="rec locked" aria-hidden>
      <div className="rec-top">
        <Icon name="channels" className="pi" />
        <div>
          <div className="rec-name">{t("lockedName", { rank })}</div>
          <div className="rec-aud">{t("lockedSub")}</div>
        </div>
        <span className="rec-lock">
          <Icon name="lock" />
          {t("locked")}
        </span>
      </div>
      <div className="rec-why">{t("lockedWhy")}</div>
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
  const t = useTranslations("LaunchChecker");
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
        setError(data.error ?? t("errorSaveGeneric"));
        setState("error");
        return;
      }
      setState("done");
    } catch {
      setError(t("errorNetwork"));
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div className="gate">
        <h3>{t("gateDoneTitle")}</h3>
        <p>{t("gateDoneBody", { count: plan.totalChannels, name: projectName })}</p>
        <div style={{ marginTop: 14 }}>
          <Link
            href={`/login?callbackUrl=${encodeURIComponent("/onboarding")}`}
            className="btn btn-p"
          >
            <Icon name="arrowRight" />
            {t("gateDoneCta")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="gate">
      <h3>{moreCount > 0 ? t("gateTitleMore", { count: moreCount }) : t("gateTitle")}</h3>
      <p>{t("gateBody")}</p>
      <form className="lc-form" onSubmit={submit} style={{ marginTop: 14 }}>
        <input
          className="lc-input"
          type="email"
          placeholder={t("emailPlaceholder")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-label={t("emailAria")}
          required
        />
        <button
          type="submit"
          className="btn btn-p"
          disabled={state === "saving" || !email.trim()}
        >
          <Icon name="mail" />
          {state === "saving" ? t("emailSubmitSaving") : t("emailSubmit")}
        </button>
      </form>
      {error && <div className="lc-error">{error}</div>}
    </div>
  );
}
