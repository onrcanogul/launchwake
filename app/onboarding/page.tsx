import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import {
  githubAppConfigured,
  appInstallUrl,
  listInstallationRepos,
  GH_INSTALLATION_COOKIE,
  type GithubRepo,
} from "@/lib/github";
import { resolveAccount } from "@/lib/team";
import { getPlanUsage, entitlementViolation } from "@/lib/billing";
import { resolveActiveProjectId } from "@/lib/projects";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { Icon } from "@/components/Icon";

/**
 * Onboarding is both the first-run flow AND the "New project" target. Over the
 * plan's project limit (Free = 1) we show an upgrade prompt instead of the
 * wizard — the same limit `createProject` enforces server-side, so this is UX,
 * not the gate.
 */
export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const { accountId } = await resolveAccount(userId);
  const usage = await getPlanUsage(userId);
  const overLimit = entitlementViolation(usage, "create_project");

  if (overLimit) {
    const activeProjectId = await resolveActiveProjectId(accountId);
    return (
      <div className="ob">
        <div className="ob-upgrade">
          <div className="ob-upgrade-ico">
            <Icon name="rocket" />
          </div>
          <h1>Add another product</h1>
          <p>{overLimit}</p>
          <div className="ob-upgrade-actions">
            {activeProjectId && (
              <Link
                href={`/app/${activeProjectId}/settings`}
                className="btn btn-p"
              >
                <Icon name="rocket" /> Upgrade to Pro
              </Link>
            )}
            <Link
              href={activeProjectId ? `/app/${activeProjectId}` : "/app"}
              className="btn btn-s"
            >
              Back to your workspace
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Repo picker source: the GitHub App installation (private repos included).
  // The install callback stashed the installation id in a cookie; with it we
  // list the granted repos. No installation → the wizard shows "Connect GitHub"
  // (install) plus the de-emphasized manual owner/repo fallback.
  const appConfigured = githubAppConfigured();
  const installationId = appConfigured
    ? ((await cookies()).get(GH_INSTALLATION_COOKIE)?.value ?? null)
    : null;
  let repos: GithubRepo[] = [];
  let reposError = false;
  if (installationId) {
    try {
      repos = await listInstallationRepos(installationId);
    } catch {
      reposError = true;
    }
  }

  return (
    <div className="ob">
      <OnboardingWizard
        repos={repos}
        appConnected={installationId !== null && !reposError}
        reposError={reposError}
        installUrl={appConfigured ? appInstallUrl("onboarding") : null}
        installationId={installationId}
      />
    </div>
  );
}
