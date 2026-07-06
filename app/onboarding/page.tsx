import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  getUserGithubToken,
  listUserRepos,
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

  // Repo picker source: the user's own public repos. Private repos are filtered
  // out (public-only for now; interest in private support is captured separately).
  // Email-auth users have no token → the wizard falls back to manual entry.
  let repos: GithubRepo[] = [];
  let githubConnected = false;
  const token = await getUserGithubToken(userId);
  if (token) {
    githubConnected = true;
    try {
      repos = (await listUserRepos(token)).filter((r) => !r.private);
    } catch {
      repos = [];
    }
  }

  return (
    <div className="ob">
      <OnboardingWizard repos={repos} githubConnected={githubConnected} />
    </div>
  );
}
