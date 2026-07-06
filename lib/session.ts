import { cache } from "react";
import { redirect, notFound } from "next/navigation";
import { auth } from "./auth";
import { db } from "./db";
import { readActiveShipId } from "./activeShip";
import { listProjectShips, type ShipListItem } from "./ships";
import { listAccountProjects, type ProjectListItem } from "./projects";
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
  /** The project named in the route. Guaranteed owned by the account (else 404). */
  project: Project;
  /** All of the account's projects — powers the sidebar project switcher. */
  projects: ProjectListItem[];
  /** This project's ships (for the ship switcher). Empty when none. */
  ships: ShipListItem[];
  /** The globally selected ship (from cookie), scoped to this project, or null. */
  activeShip: ShipListItem | null;
  /** Size of the global channel catalog (shown in nav). */
  channelsCount: number;
};

/**
 * Load the workspace scoped to the project named in the route (`/app/[project]`).
 * Redirects to /login if unauthenticated; 404s (notFound) when the project isn't
 * owned by the signed-in account — so another user's project is indistinguishable
 * from a nonexistent one. Wrapped in cache() keyed on `projectId`, so the layout
 * and page share a single result per request.
 *
 * Team members share the paying owner's workspace: we resolve `accountId` once
 * and scope everything to it, while `user` stays the signed-in identity.
 */
export const getWorkspace = cache(
  async (projectId: string): Promise<Workspace> => {
    const session = await auth();
    if (!session?.user?.id) redirect("/login");
    const userId = session.user.id;

    const [user, resolved, activeShipId, channelsCount] = await Promise.all([
      db.user.findUnique({ where: { id: userId } }),
      resolveAccount(userId),
      readActiveShipId(),
      db.channel.count(),
    ]);
    if (!user) redirect("/login");

    const { accountId, role } = resolved;

    // Load the requested project scoped to the account (authorization = ownership)
    // plus the account plan and the full project list, in one wave.
    const [account, project, projects] = await Promise.all([
      accountId === userId
        ? Promise.resolve(user)
        : db.user.findUnique({ where: { id: accountId } }),
      db.project.findFirst({ where: { id: projectId, userId: accountId } }),
      listAccountProjects(accountId),
    ]);
    if (!project) notFound();
    const plan = account?.plan ?? user.plan;

    const ships = await listProjectShips(project.id);
    // The active-ship cookie is global; only honor it when the ship is in THIS
    // project, so switching projects doesn't carry a stale selection across.
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
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        subtitle: projectSubtitle(p),
      })),
      ships,
      activeShip,
      channelsCount,
    };
  },
);

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
