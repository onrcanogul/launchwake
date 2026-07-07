import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/session";
import { resolveAccount } from "@/lib/team";
import { resolveActiveProjectId } from "@/lib/projects";

/**
 * Bare `/app` — resolves the account's most recently active project (cookie →
 * oldest) and redirects into it. New users with no project go to onboarding.
 * This is a temporary redirect (the target depends on cookie/state), unlike the
 * legacy flat-path stubs which 308.
 */
export default async function AppIndex() {
  const user = await requireSessionUser();
  const { accountId } = await resolveAccount(user.id);

  const projectId = await resolveActiveProjectId(accountId);
  if (!projectId) redirect("/onboarding");
  redirect(`/app/${projectId}`);
}
