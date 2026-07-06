"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { resolveAccount } from "@/lib/team";
import { ACTIVE_SHIP_COOKIE } from "@/lib/activeShip";

/**
 * Set the globally active ship (persisted in a cookie). Validates that the ship
 * belongs to the signed-in user before storing it. Idempotent.
 */
export async function setActiveShip(shipId: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) return;
  const { accountId } = await resolveAccount(session.user.id);

  const ship = await db.ship.findFirst({
    where: { id: shipId, project: { userId: accountId } },
    select: { id: true },
  });
  if (!ship) return;

  const store = await cookies();
  if (store.get(ACTIVE_SHIP_COOKIE)?.value === shipId) return; // unchanged

  store.set(ACTIVE_SHIP_COOKIE, shipId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  // The shell layout is cached; refresh it so the sidebar reflects the new
  // active ship on project-wide pages too.
  revalidatePath("/app/[project]", "layout");
}
