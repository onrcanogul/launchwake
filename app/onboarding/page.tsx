import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  getUserGithubToken,
  listUserRepos,
  type GithubRepo,
} from "@/lib/github";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  // Already onboarded → straight to the app.
  const existing = await db.project.findFirst({
    where: { userId: session.user.id },
  });
  if (existing) redirect("/app");

  // Repo picker source: the user's own public repos. Private repos are filtered
  // out (public-only for now; interest in private support is captured separately).
  // Email-auth users have no token → the wizard falls back to manual entry.
  let repos: GithubRepo[] = [];
  let githubConnected = false;
  const token = await getUserGithubToken(session.user.id);
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
