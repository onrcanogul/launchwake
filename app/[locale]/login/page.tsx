import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import Image from "next/image";
import { alternatesFor, type Locale } from "@/i18n/paths";
import { LoginForm } from "@/components/auth/LoginForm";
import { env } from "@/lib/env";

export async function generateMetadata(props: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: "Login" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: alternatesFor("/login", locale),
  };
}

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { callbackUrl, error } = await searchParams;
  const t = await getTranslations("Login");

  return (
    <section className="auth">
      <div className="authcard">
        <div className="authlogo">
          <Image
            src="/logo.png"
            alt="LaunchWake"
            width={26}
            height={26}
            className="authlogo-logo"
            priority
          />
          LaunchWake
        </div>
        <p className="sub">{t("subtitle")}</p>

        {error && (
          <p
            style={{
              color: "var(--danger, #d64545)",
              fontSize: 13,
              textAlign: "center",
              marginBottom: 12,
            }}
            role="alert"
          >
            {error === "OAuthAccountNotLinked"
              ? t("signinErrorLinked")
              : t("signinError")}
          </p>
        )}

        <LoginForm
          githubEnabled={Boolean(env.AUTH_GITHUB_ID && env.AUTH_GITHUB_SECRET)}
          emailEnabled={Boolean(env.EMAIL_SERVER && env.EMAIL_FROM)}
          demoEnabled={env.NODE_ENV !== "production"}
          callbackUrl={callbackUrl ?? "/app"}
        />

        <p className="authfoot">{t("footer")}</p>
      </div>

      <svg
        className="waves"
        viewBox="0 0 1200 120"
        preserveAspectRatio="none"
        aria-hidden
      >
        <path
          d="M0,70 C150,30 300,110 450,70 C600,30 750,110 900,70 C1050,30 1200,110 1200,70 L1200,120 L0,120 Z"
          fill="#0D0F14"
        />
        <path
          d="M0,80 C150,45 300,110 450,80 C600,45 750,110 900,80 C1050,45 1200,110 1200,80"
          fill="none"
          stroke="#3ECFB6"
          strokeWidth="1.5"
          opacity=".35"
        />
      </svg>
    </section>
  );
}
