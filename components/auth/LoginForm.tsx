"use client";

import { useState } from "react";
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
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const start = (id: string, extra?: Record<string, unknown>) => {
    setPending(id);
    void signIn(id, { callbackUrl, ...extra });
  };

  const sendEmail = () => {
    if (!email) return;
    setPending("nodemailer");
    void signIn("nodemailer", { email, callbackUrl }).then(() => {
      setSent(true);
      setPending(null);
    });
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
          Continue with GitHub
        </button>
      )}

      {emailEnabled && (
        <>
          {githubEnabled && <div className="divider">or</div>}
          {sent ? (
            <p style={{ color: "var(--ac)", fontSize: 13, textAlign: "center" }}>
              Check your inbox for a magic link.
            </p>
          ) : (
            <>
              <label className="fl">Work email</label>
              <input
                className="inp"
                placeholder="you@startup.dev"
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
                Continue with email
              </button>
            </>
          )}
        </>
      )}

      {!githubEnabled && !emailEnabled && (
        <p style={{ color: "var(--tx3)", fontSize: 12, textAlign: "center" }}>
          No OAuth providers are configured. Set AUTH_GITHUB_ID / EMAIL_SERVER in
          your env to enable sign-in.
        </p>
      )}

      {demoEnabled && (
        <>
          <div className="divider">demo</div>
          <button
            className="btn btn-s btn-lg"
            onClick={() => start("demo", { callbackUrl: "/app" })}
            disabled={pending !== null}
          >
            <Icon name="arrowRight" /> Continue as demo (Hookline)
          </button>
        </>
      )}
    </div>
  );
}
