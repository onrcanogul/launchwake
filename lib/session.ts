import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "./auth";
import { db } from "./db";
import { readActiveShipId } from "./activeShip";
import { listProjectShips, type ShipListItem } from "./ships";
import type { Project, User } from "@prisma/client";

export type Workspace = {
  user: Pick<User, "id" | "name" | "email" | "plan">;
  /** The user's primary project, or null if they haven't onboarded yet. */
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
 */
export const getWorkspace = cache(async (): Promise<Workspace> => {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
  });
  if (!user) redirect("/login");

  const project = await db.project.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });

  const ships = project ? await listProjectShips(project.id) : [];
  const activeShipId = await readActiveShipId();
  const activeShip = ships.find((s) => s.id === activeShipId) ?? null;

  const channelsCount = await db.channel.count();

  return {
    user: { id: user.id, name: user.name, email: user.email, plan: user.plan },
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
