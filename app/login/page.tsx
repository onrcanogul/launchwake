import { Icon } from "@/components/Icon";
import { LoginForm } from "@/components/auth/LoginForm";
import { env } from "@/lib/env";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;

  return (
    <section className="auth">
      <div className="authcard">
        <div className="authlogo">
          <Icon name="wave" /> LaunchWake
        </div>
        <p className="sub">Marketing intel for founders who&apos;d rather be coding.</p>

        <LoginForm
          githubEnabled={Boolean(env.AUTH_GITHUB_ID && env.AUTH_GITHUB_SECRET)}
          emailEnabled={Boolean(env.EMAIL_SERVER && env.EMAIL_FROM)}
          demoEnabled={env.NODE_ENV !== "production"}
          callbackUrl={callbackUrl ?? "/app"}
        />

        <p className="authfoot">
          GitHub is recommended — it enables ship auto-detection later.
        </p>
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
