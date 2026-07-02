import type { Metadata } from "next";
import { PublicShell } from "@/components/public/PublicShell";
import { LaunchChecker } from "@/components/public/LaunchChecker";
import { PUBLIC_FREE_RECS } from "@/lib/launchChecker";
import { Icon } from "@/components/Icon";

export const metadata: Metadata = {
  title: "Launch Checker — where should you post your GitHub project? | LaunchWake",
  description:
    "Paste a GitHub repo and get a free, ranked distribution plan: which communities fit your product, each one's ban risk, and how to post there safely. No login.",
  alternates: { canonical: "/tools/launch-checker" },
};

export default function LaunchCheckerPage() {
  return (
    <PublicShell>
      <div className="pub-eyebrow">
        <Icon name="target" />
        Free Launch Checker
      </div>
      <h1 className="pub-h1">Where should you launch this?</h1>
      <p className="pub-lede">
        Paste your GitHub repo. We&apos;ll read what you built and rank the
        communities technical founders launch in — by fit, ban risk, and the safe
        way to post in each. No account, no code access.
      </p>

      <LaunchChecker freeCount={PUBLIC_FREE_RECS} />
    </PublicShell>
  );
}
