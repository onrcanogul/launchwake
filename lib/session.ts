import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "./auth";
import { db } from "./db";
import { readActiveShipId } from "./activeShip";
import { listProjectShips, type ShipListItem } from "./ships";
import { resolveAccount, type AccountRole } from "./team";
import type { Plan, Project, User } from "@prisma/client";

export type Workspace = {
  user: Pick<User, "id" | "name" | "email" | "plan" | "emailNotifications">;
  /**
   * The account whose data this user sees. For a Team member this is the owner's
   * id; for everyone else it's their own. ALL data queries scope to this.
   */
  accountId: string;
  /** OWNER for solo users & Team owners; MEMBER for someone on a Team seat. */
  role: AccountRole;
  /** The account's plan (the owner's plan for members) — for gating + display. */
  plan: Plan;
  /** The account's primary project, or null if not onboarded yet. */
  project: Project | null;
  /** All ships (for the ship switcher). Empty when no project/ships. */
  ships: ShipListItem[];
  /** The globally selected ship (from cookie), or null if none is selected. */
  activeShip: ShipListItem | null;
  /** Size of the global channel catalog (shown in nav). */
  channelsCount: number;
};

/**
 * Load the signed-in user's workspace. Redirects to /login if unauthenticated.
 * Wrapped in cache() so the layout and page share one result per request.
 *
 * Team members share the paying owner's workspace: we resolve `accountId` once
 * and scope project/ships/plan to it, while `user` stays the signed-in identity.
 */
export const getWorkspace = cache(async (): Promise<Workspace> => {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  // These four only depend on the signed-in user id, so fire them together as
  // one round-trip wave instead of awaiting each in turn.
  const [user, resolved, activeShipId, channelsCount] = await Promise.all([
    db.user.findUnique({ where: { id: userId } }),
    resolveAccount(userId),
    readActiveShipId(),
    db.channel.count(),
  ]);
  if (!user) redirect("/login");

  const { accountId, role } = resolved;

  // account (for the plan) and project both key off accountId → run in parallel.
  const [account, project] = await Promise.all([
    accountId === userId
      ? Promise.resolve(user)
      : db.user.findUnique({ where: { id: accountId } }),
    db.project.findFirst({
      where: { userId: accountId },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  const plan = account?.plan ?? user.plan;

  const ships = project ? await listProjectShips(project.id) : [];
  const activeShip = ships.find((s) => s.id === activeShipId) ?? null;

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      plan: user.plan,
      emailNotifications: user.emailNotifications,
    },
    accountId,
    role,
    plan,
    project,
    ships,
    activeShip,
    channelsCount,
  };
});

/** Display name fallback (email local-part) for the shell. */
export function displayName(user: Pick<User, "name" | "email">): string {
  return user.name ?? user.email.split("@")[0];
}

/** Short subtitle under the workspace name (tagline / repo / host). */
export function projectSubtitle(
  project: Pick<Project, "description" | "githubRepo" | "url">,
): string | null {
  if (project.githubRepo) return project.githubRepo;
  if (project.url) {
    try {
      return new URL(project.url).host.replace(/^www\./, "");
    } catch {
      return project.url;
    }
  }
  return null;
}
