"use server";

import { auth } from "@/lib/auth";
import { acceptInvite } from "@/lib/team";

/** Accept a Team invite as the signed-in user. */
export async function acceptTeamInvite(
  token: string,
): Promise<{ ok: boolean; error?: string; ownerName?: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "Sign in to accept this invite." };
  }
  const res = await acceptInvite(token, session.user.id);
  return res.ok ? { ok: true, ownerName: res.ownerName } : { ok: false, error: res.error };
}
