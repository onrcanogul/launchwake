import { redirect, permanentRedirect, notFound } from "next/navigation";
import { auth } from "./auth";
import { db } from "./db";
import { resolveAccount } from "./team";
import { resolveActiveProjectId } from "./projects";

// Re-exported so the legacy stub routes can import query + redirect helpers from
// one place.
export { toQuery } from "./appRoutes";

/**
 * Permanent redirects for the pre-multi-project flat URLs (`/app/results`,
 * `/app/ships/:id/plan`, …) so old bookmarks never break. These live as static
 * route stubs, which Next matches ahead of the `[project]` dynamic segment, so
 * there is no ambiguity between `/app/results` (legacy) and `/app/:project`.
 *
 * We use 308 (permanentRedirect) rather than a hand-rolled 301: both are
 * permanent and cacheable, and 308 preserves the method — the modern equivalent.
 */

async function accountId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { accountId } = await resolveAccount(session.user.id);
  return accountId;
}

/**
 * Project-wide / ship-bare legacy section (`""` for the feed, else `"results"`,
 * `"plan"`, …). Resolves the active project (cookie → oldest) and 308s to its
 * scoped equivalent, preserving any query string. → /onboarding when the account
 * has no project yet.
 */
export async function redirectLegacySection(
  section: string,
  query = "",
): Promise<never> {
  const acct = await accountId();
  const projectId = await resolveActiveProjectId(acct);
  if (!projectId) redirect("/onboarding");
  const base = section ? `/app/${projectId}/${section}` : `/app/${projectId}`;
  permanentRedirect(`${base}${query}`);
}

/**
 * Legacy ship-scoped URL (`/app/ships/:id/:section`). The project is derived from
 * the ship itself (authoritative), scoped to the account so another user's ship
 * 404s rather than leaking its project id.
 */
export async function redirectLegacyShip(
  shipId: string,
  section: string,
  query = "",
): Promise<never> {
  const acct = await accountId();
  const ship = await db.ship.findFirst({
    where: { id: shipId, project: { userId: acct } },
    select: { projectId: true },
  });
  if (!ship) notFound();
  permanentRedirect(
    `/app/${ship.projectId}/ships/${shipId}/${section}${query}`,
  );
}
