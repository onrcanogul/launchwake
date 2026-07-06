"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { resolveAccount } from "@/lib/team";
import { generatePitch, setPitchStatus } from "@/lib/pitch";
import type { PitchStatus } from "@prisma/client";

async function requireAccount(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { accountId } = await resolveAccount(session.user.id);
  return accountId;
}

function refresh() {
  revalidatePath("/app/[project]/ships/[id]/pitches", "page");
  revalidatePath("/app/[project]/pitches", "page");
}

export type PitchState = { ok: boolean; subject?: string; body?: string; error?: string };

/** Generate (or regenerate) the curator pitch for one newsletter. */
export async function writePitch(shipId: string, channelId: string): Promise<PitchState> {
  const accountId = await requireAccount();
  const owned = await db.ship.findFirst({
    where: { id: shipId, project: { userId: accountId } },
    select: { id: true },
  });
  if (!owned) return { ok: false, error: "Ship not found." };
  try {
    const res = await generatePitch(shipId, channelId);
    refresh();
    return { ok: true, subject: res.subject, body: res.body };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/** Update a pitch's status (SENT schedules a follow-up; REPLIED/DECLINED stop it). */
export async function markPitchStatus(pitchId: string, status: PitchStatus): Promise<void> {
  await setPitchStatus(pitchId, await requireAccount(), status);
  refresh();
}
