"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { signIn } from "next-auth/react";
import { Icon } from "@/components/Icon";
import { requestMagicLink, stashSignupSource } from "@/components/auth/loginActions";
import { SELF_REPORT_OPTIONS } from "@/lib/selfReport";

type Props = {
  githubEnabled: boolean;
  emailEnabled: boolean;
  demoEnabled: boolean;
  callbackUrl: string;
};

export function LoginForm({
  githubEnabled,
  emailEnabled,
  demoEnabled,
  callbackUrl,
}: Props) {
  const t = useTranslations("Login");
  const [email, setEmail] = useState("");
  const [heard, setHeard] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(false);
  const [invalid, setInvalid] = useState(false);

  const start = (id: string, extra?: Record<string, unknown>) => {
    setPending(id);
    void signIn(id, { callbackUrl, ...extra });
  };

  // GitHub has no email pre-auth, so stash the "how did you hear" answer in a
  // cookie that rides the OAuth redirect back, then start the sign-in.
  const startGithub = async () => {
    setPending("github");
    if (heard) {
      try {
        await stashSignupSource(heard);
      } catch {
        /* attribution is best-effort — never block sign-in */
      }
    }
    void signIn("github", { callbackUrl });
  };

  const sendEmail = async () => {
    if (!email) return;
    setPending("nodemailer");
    setError(false);
    setInvalid(false);
    try {
      // Rate-limit gate runs BEFORE Auth.js is invoked. The self-reported source
      // (if any) is stashed keyed by email inside the gate.
      const gate = await requestMagicLink(email, heard || undefined);
      if (!gate.ok && gate.reason === "invalid") {
        setInvalid(true);
        return;
      }
      if (!gate.ok) {
        // Rate-limited → present exactly like a successful send. Never reveal
        // that a limit was hit (or whether the address is registered).
        setSent(true);
        return;
      }
      // redirect:false so a send failure (SMTP/config) surfaces inline here
      // instead of navigating to NextAuth's generic "Server error" page.
      const res = await signIn("nodemailer", {
        email,
        callbackUrl,
        redirect: false,
      });
      if (res?.error) setError(true);
      else setSent(true);
    } catch {
      setError(true);
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="authbox">
      {!sent && (githubEnabled || emailEnabled) && (
        <div style={{ marginBottom: 14 }}>
          <label className="fl" htmlFor="lw-heard">
            {t("heardLabel")}
          </label>
          <select
            id="lw-heard"
            className="inp"
            value={heard}
            onChange={(e) => setHeard(e.target.value)}
            disabled={pending !== null}
          >
            <option value="">{t("heardDefault")}</option>
            {SELF_REPORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {githubEnabled && (
        <button
          className="oauth"
          onClick={() => void startGithub()}
          disabled={pending !== null}
        >
          <Icon name="github" style={{ fill: "currentColor", stroke: "none" }} />
          {t("continueGithub")}
        </button>
      )}

      {emailEnabled && (
        <>
          {githubEnabled && <div className="divider">{t("or")}</div>}
          {sent ? (
            <p style={{ color: "var(--ac)", fontSize: 13, textAlign: "center" }}>
              {t("magicLinkSent")}
            </p>
          ) : (
            <>
              <label className="fl">{t("workEmail")}</label>
              <input
                className="inp"
                placeholder={t("emailPlaceholder")}
                style={{ marginBottom: 12 }}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <button
                className="btn btn-p btn-lg"
                onClick={() => void sendEmail()}
                disabled={pending !== null}
              >
                {t("continueEmail")}
              </button>
              {invalid && (
                <p
                  style={{
                    color: "var(--danger, #d64545)",
                    fontSize: 13,
                    textAlign: "center",
                    marginTop: 10,
                  }}
                  role="alert"
                >
                  {t("emailInvalid")}
                </p>
              )}
              {error && (
                <p
                  style={{
                    color: "var(--danger, #d64545)",
                    fontSize: 13,
                    textAlign: "center",
                    marginTop: 10,
                  }}
                  role="alert"
                >
                  {t("emailError")}
                </p>
              )}
            </>
          )}
        </>
      )}

      {!githubEnabled && !emailEnabled && (
        <p style={{ color: "var(--tx3)", fontSize: 12, textAlign: "center" }}>
          {t("noProviders")}
        </p>
      )}

      {demoEnabled && (
        <>
          <div className="divider">{t("demo")}</div>
          <button
            className="btn btn-s btn-lg"
            onClick={() => start("demo", { callbackUrl: "/app" })}
            disabled={pending !== null}
          >
            <Icon name="arrowRight" /> {t("continueDemo")}
          </button>
        </>
      )}
    </div>
  );
}
