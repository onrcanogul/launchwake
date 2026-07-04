"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { signIn } from "next-auth/react";
import { Icon } from "@/components/Icon";

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
  const [pending, setPending] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(false);

  const start = (id: string, extra?: Record<string, unknown>) => {
    setPending(id);
    void signIn(id, { callbackUrl, ...extra });
  };

  const sendEmail = () => {
    if (!email) return;
    setPending("nodemailer");
    setError(false);
    // redirect:false so a send failure (SMTP/config) surfaces inline here
    // instead of navigating to NextAuth's generic "Server error" page.
    void signIn("nodemailer", { email, callbackUrl, redirect: false })
      .then((res) => {
        if (res?.error) setError(true);
        else setSent(true);
      })
      .catch(() => setError(true))
      .finally(() => setPending(null));
  };

  return (
    <div className="authbox">
      {githubEnabled && (
        <button
          className="oauth"
          onClick={() => start("github")}
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
                onClick={sendEmail}
                disabled={pending !== null}
              >
                {t("continueEmail")}
              </button>
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
