"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseRepo } from "@/lib/github";

const Schema = z.object({
  name: z.string().trim().min(1, "Product name is required").max(120),
  url: z.string().trim().url("Enter a valid URL").optional().or(z.literal("")),
  githubRepo: z.string().trim().max(200).optional().or(z.literal("")),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
});

export type OnboardingState = { error?: string };

export async function createProject(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const parsed = Schema.safeParse({
    name: formData.get("name"),
    url: formData.get("url") || undefined,
    githubRepo: formData.get("githubRepo") || undefined,
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  // Normalise a GitHub repo/URL down to "owner/repo".
  let githubRepo: string | null = null;
  if (parsed.data.githubRepo) {
    const ref = parseRepo(parsed.data.githubRepo);
    if (!ref) return { error: "GitHub repo must be owner/repo or a GitHub URL." };
    githubRepo = `${ref.owner}/${ref.repo}`;
  }

  await db.project.create({
    data: {
      userId: session.user.id,
      name: parsed.data.name,
      url: parsed.data.url || null,
      githubRepo,
      description: parsed.data.description || null,
    },
  });

  redirect("/app/ships/new");
}
