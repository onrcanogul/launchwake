"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Icon } from "@/components/Icon";

/**
 * Landing giveaway: a scarcity CTA on the marketing page — leave an email for a
 * chance at full early access, free. No account, no LLM. Reuses the shared lead
 * pipeline (POST /api/public/lead) with a distinct `source` so these signups can
 * be told apart from the Launch Checker's captures. On success it swaps to a
 * confirmation, keeping the free Launch Checker one click away.
 */
export function EarlyAccessSignup() {
  const t = useTranslations("Landing");
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);

  const perks = t.raw("giveawayPerks") as string[];

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
          source: "landing-free-tier",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t("giveawayError"));
        setState("error");
        return;
      }
      setState("done");
    } catch {
      setError(t("giveawayError"));
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div className="gate ea-card">
        <span className="lp-ic" aria-hidden>
          <Icon name="check" />
        </span>
        <h3>{t("giveawayDoneTitle")}</h3>
        <p>{t("giveawayDoneBody")}</p>
        <div style={{ marginTop: 16 }}>
          <Link href="/tools/launch-checker" className="btn btn-s">
            <Icon name="target" />
            {t("giveawayDoneCta")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="gate ea-card">
      <ul className="lp-chips" style={{ margin: "0 auto 18px" }}>
        {perks.map((p) => (
          <li key={p} className="lp-chip">
            <Icon name="check" />
            {p}
          </li>
        ))}
      </ul>
      <form
        className="lc-form"
        onSubmit={submit}
        style={{ justifyContent: "center" }}
      >
        <input
          className="lc-input"
          type="email"
          placeholder={t("giveawayEmailPlaceholder")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-label={t("giveawayEmailAria")}
          autoComplete="email"
          required
        />
        <button
          type="submit"
          className="btn btn-p"
          disabled={state === "saving" || !email.trim()}
        >
          <Icon name="mail" />
          {state === "saving" ? t("giveawaySubmitSaving") : t("giveawaySubmit")}
        </button>
      </form>
      {error && <div className="lc-error">{error}</div>}
      <p className="ea-note">{t("giveawayNote")}</p>
    </div>
  );
}
