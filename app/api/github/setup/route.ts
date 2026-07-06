import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { resolveAccount } from "@/lib/team";
import { env } from "@/lib/env";
import { parseSetupCallback, GH_INSTALLATION_COOKIE } from "@/lib/github";

/**
 * GitHub App install/setup callback. After the user picks repos on GitHub, it
 * redirects here with `installation_id` (+ our `state`). We capture the
 * installation and send the user back where they started:
 *   - state "onboarding"      → stash the installation id in a cookie (no project
 *                               exists yet); the wizard's picker reads it.
 *   - state "project:<id>"    → persist githubInstallationId on that owned project.
 * The installation grants read-only access; we never request write scopes.
 */
export async function GET(req: NextRequest) {
  const appUrl = env.APP_URL.replace(/\/$/, "");
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(`${appUrl}/login`);
  }

  const parsed = parseSetupCallback(req.nextUrl.searchParams);
  if (!parsed) {
    // Malformed callback — don't trust it; return the user to onboarding.
    return NextResponse.redirect(`${appUrl}/onboarding?github=error`);
  }
  const installationId = String(parsed.installation_id);
  const state = parsed.state ?? "onboarding";

  // Where to send the user back, and (for the project state) persist the id.
  let dest = `${appUrl}/onboarding?github=connected`;
  const projectMatch = /^project:(.+)$/.exec(state);
  if (projectMatch) {
    const { accountId } = await resolveAccount(session.user.id);
    const projectId = projectMatch[1];
    const owned = await db.project.findFirst({
      where: { id: projectId, userId: accountId },
      select: { id: true },
    });
    if (owned) {
      await db.project.update({
        where: { id: owned.id },
        data: { githubInstallationId: installationId },
      });
      dest = `${appUrl}/app/${owned.id}/settings?github=connected`;
    } else {
      dest = `${appUrl}/app`; // not theirs → bare resolver
    }
  }

  const res = NextResponse.redirect(dest);
  // Bridge cookie for the onboarding picker (harmless alongside the project write).
  res.cookies.set(GH_INSTALLATION_COOKIE, installationId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60, // 1h — transient; the id is persisted on a project once picked
  });
  return res;
}
