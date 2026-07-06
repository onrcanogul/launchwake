import { cookies } from "next/headers";
import { db } from "./db";
import { pickActiveProjectId } from "./appRoutes";
import type { Project } from "@prisma/client";

/**
 * Multi-project foundation. The app route is `/app/[project]/…` keyed on the
 * project id (not a slug): an id is globally unique, needs no backfill/collision
 * handling, and lets ownership double as authorization (`{ id, userId }`).
 *
 * "Last active project" is a cookie (mirrors `lw_active_ship`) rather than a User
 * column — no schema migration, no write on every navigation, and exactly the
 * semantics bare `/app` needs. The cookie is untrusted: every consumer validates
 * ownership before using it, so a tampered value only ever falls back.
 */
export const ACTIVE_PROJECT_COOKIE = "lw_active_project";

export type ProjectListItem = {
  id: string;
  name: string;
  subtitle: string | null;
};

export async function readActiveProjectId(): Promise<string | null> {
  const store = await cookies();
  return store.get(ACTIVE_PROJECT_COOKIE)?.value ?? null;
}

/** All of an account's projects, oldest first (stable order for the switcher). */
export async function listAccountProjects(accountId: string): Promise<Project[]> {
  return db.project.findMany({
    where: { userId: accountId },
    orderBy: { createdAt: "asc" },
  });
}

/** Load a project only if the account owns it (else null → caller returns 404). */
export async function getOwnedProject(
  projectId: string,
  accountId: string,
): Promise<Project | null> {
  return db.project.findFirst({ where: { id: projectId, userId: accountId } });
}

/**
 * Resolve which project a bare/legacy request should land on: the requested id
 * if owned, else the cookie's last-active if owned, else the oldest project
 * (matches the pre-multi-project "primary project" order). Null when the account
 * has no projects yet (→ onboarding).
 */
export async function resolveActiveProjectId(
  accountId: string,
  requested?: string | null,
): Promise<string | null> {
  const [projects, cookieId] = await Promise.all([
    db.project.findMany({
      where: { userId: accountId },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    }),
    readActiveProjectId(),
  ]);
  return pickActiveProjectId(
    projects.map((p) => p.id),
    requested,
    cookieId,
  );
}
