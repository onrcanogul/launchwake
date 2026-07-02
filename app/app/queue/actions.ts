"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { resolveAccount } from "@/lib/team";
import { setTaskStatus } from "@/lib/queue";

async function requireAccount(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { accountId } = await resolveAccount(session.user.id);
  return accountId;
}

function refresh() {
  revalidatePath("/app/ships/[id]/queue", "page");
  revalidatePath("/app/queue");
}

/** Mark a queue task done. */
export async function completeTask(taskId: string): Promise<void> {
  await setTaskStatus(taskId, await requireAccount(), "DONE");
  refresh();
}

/** Skip a queue task (not relevant for this product). */
export async function skipTask(taskId: string): Promise<void> {
  await setTaskStatus(taskId, await requireAccount(), "SKIPPED");
  refresh();
}

/** Re-open a done/skipped task. */
export async function reopenTask(taskId: string): Promise<void> {
  await setTaskStatus(taskId, await requireAccount(), "PENDING");
  refresh();
}
