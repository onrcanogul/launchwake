"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { resolveAccount } from "@/lib/team";
import { assertEntitlement, EntitlementError } from "@/lib/billing";
import { assertQueryOwned, assertMatchOwned } from "@/lib/intentQueries";
import { generateIntentReply } from "@/lib/intentRadar";

async function requireAccount(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { accountId } = await resolveAccount(session.user.id);
  return accountId;
}

async function requireProject(): Promise<{ accountId: string; projectId: string }> {
  const accountId = await requireAccount();
  const project = await db.project.findFirst({
    where: { userId: accountId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!project) redirect("/onboarding");
  return { accountId, projectId: project.id };
}

/** Split a comma/newline separated textarea into a clean, deduped list. */
function toList(raw: FormDataEntryValue | null, max: number): string[] {
  if (typeof raw !== "string") return [];
  const items = raw
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return [...new Set(items)].slice(0, max);
}

const CreateSchema = z.object({
  title: z.string().trim().min(3, "Give the watch a short name").max(120),
  keywords: z.array(z.string()).min(1, "Add at least one topic keyword"),
  phrases: z.array(z.string()),
  subreddits: z.array(z.string()),
});

export type IntentQueryState = { error?: string; ok?: boolean };

/** Create a saved Intent Radar query (gated by plan entitlement). */
export async function createIntentQuery(
  _prev: IntentQueryState,
  formData: FormData,
): Promise<IntentQueryState> {
  const { accountId, projectId } = await requireProject();

  try {
    await assertEntitlement(accountId, "create_intent_query");
  } catch (err) {
    if (err instanceof EntitlementError) return { error: err.message };
    throw err;
  }

  const parsed = CreateSchema.safeParse({
    title: formData.get("title"),
    keywords: toList(formData.get("keywords"), 12),
    phrases: toList(formData.get("phrases"), 12),
    subreddits: toList(formData.get("subreddits"), 8).map((s) =>
      s.replace(/^\/?r\//i, "").trim(),
    ),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await db.intentQuery.create({
    data: { projectId, ...parsed.data },
  });
  revalidatePath("/app/radar");
  return { ok: true };
}

/** Toggle a query on/off (paused queries are skipped by the cron). */
export async function toggleIntentQuery(queryId: string, active: boolean): Promise<void> {
  const accountId = await requireAccount();
  await assertQueryOwned(queryId, accountId);
  await db.intentQuery.update({ where: { id: queryId }, data: { active } });
  revalidatePath("/app/radar");
}

/** Delete a query and all its matches. */
export async function deleteIntentQuery(queryId: string): Promise<void> {
  const accountId = await requireAccount();
  await assertQueryOwned(queryId, accountId);
  await db.intentQuery.delete({ where: { id: queryId } });
  revalidatePath("/app/radar");
}

/** Hide a match from the feed. */
export async function dismissMatch(matchId: string): Promise<void> {
  const accountId = await requireAccount();
  await assertMatchOwned(matchId, accountId);
  await db.intentMatch.update({ where: { id: matchId }, data: { status: "DISMISSED" } });
  revalidatePath("/app/radar");
}

/** Star a match (kept, not dismissed). */
export async function saveMatch(matchId: string): Promise<void> {
  const accountId = await requireAccount();
  await assertMatchOwned(matchId, accountId);
  await db.intentMatch.update({ where: { id: matchId }, data: { status: "SAVED" } });
  revalidatePath("/app/radar");
}

export type ReplyState = { ok: boolean; body?: string; safetyNote?: string; error?: string };

/** Generate (or regenerate) the ban-safe draft reply for a match, on demand. */
export async function generateReply(matchId: string): Promise<ReplyState> {
  const accountId = await requireAccount();
  await assertMatchOwned(matchId, accountId);
  try {
    const res = await generateIntentReply(matchId);
    revalidatePath("/app/radar");
    return { ok: true, body: res.body, safetyNote: res.safetyNote ?? undefined };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
