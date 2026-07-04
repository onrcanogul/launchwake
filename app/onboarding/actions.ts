"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseRepo, suggestShip, type ShipSuggestion } from "@/lib/github";
import { assertEntitlement, EntitlementError } from "@/lib/billing";
import { buildPlan } from "@/lib/analysis";
import { captureLead } from "@/lib/leads";
import { normalizeHttpUrl } from "@/lib/url";
import { fieldErrorsFromZod } from "@/lib/formErrors";

const Schema = z.object({
  name: z.string().trim().min(1, "Product name is required").max(120),
  // Accept a bare domain ("myapp.com"), a full URL, or empty. A non-empty value
  // must normalize to a canonical http(s) URL; anything else is a field error.
  url: z
    .string()
    .trim()
    .max(500, "URL must be 500 characters or fewer")
    .optional()
    .or(z.literal(""))
    .transform((v, ctx) => {
      if (!v) return "";
      const normalized = normalizeHttpUrl(v);
      if (!normalized) {
        ctx.addIssue({ code: "custom", message: "Enter a valid URL" });
        return z.NEVER;
      }
      return normalized;
    }),
  githubRepo: z.string().trim().max(200).optional().or(z.literal("")),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  // The branching question — required. Drives Launch Mode vs Growth Mode.
  launchStage: z.enum(["PRE_LAUNCH", "UNANNOUNCED", "LAUNCHED"]),
});

export type OnboardingState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

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
    launchStage: formData.get("launchStage"),
  });
  if (!parsed.success) {
    const { fieldErrors, formError } = fieldErrorsFromZod(parsed.error);
    return { error: formError, fieldErrors };
  }
  const { launchStage } = parsed.data;

  // Free-plan gate: 1 project.
  try {
    await assertEntitlement(session.user.id, "create_project");
  } catch (err) {
    if (err instanceof EntitlementError) return { error: err.message };
    throw err;
  }

  // Normalise a GitHub repo/URL down to "owner/repo".
  let githubRepo: string | null = null;
  if (parsed.data.githubRepo) {
    const ref = parseRepo(parsed.data.githubRepo);
    if (!ref) {
      return {
        fieldErrors: {
          githubRepo: "Enter it as owner/repo or a GitHub URL.",
        },
      };
    }
    githubRepo = `${ref.owner}/${ref.repo}`;
  }

  const project = await db.project.create({
    data: {
      userId: session.user.id,
      name: parsed.data.name,
      url: parsed.data.url || null,
      githubRepo,
      description: parsed.data.description || null,
      launchStage,
    },
  });

  // ── Branch on launch stage ────────────────────────────────
  // PRE_LAUNCH / UNANNOUNCED → Launch Mode: create the LAUNCH ship the whole
  // guided flow orbits, then land on the readiness stage (no plan yet — the
  // plan is built in the channel-plan stage, and readiness lists it as a step).
  if (launchStage === "PRE_LAUNCH" || launchStage === "UNANNOUNCED") {
    const ship = await db.ship.create({
      data: {
        projectId: project.id,
        type: "LAUNCH",
        title: `Launch: ${parsed.data.name}`,
        summary:
          parsed.data.description || `Introducing ${parsed.data.name}.`,
        sourceUrl: parsed.data.url || null,
      },
    });
    revalidatePath("/app", "layout");
    redirect(`/app/ships/${ship.id}/readiness`);
  }

  // LAUNCHED → Growth Mode (existing behaviour): create the first ship from the
  // repo's latest release/commit (or a synthetic launch) AND build its plan now,
  // so the plan page renders a finished plan and never analyses on open.
  let firstShipId: string | null = null;
  try {
    let suggestion: ShipSuggestion | null = null;
    if (githubRepo) {
      const ref = parseRepo(githubRepo);
      if (ref) suggestion = await suggestShip(ref);
    }
    if (!suggestion && (parsed.data.url || parsed.data.description)) {
      suggestion = {
        type: "LAUNCH",
        title: `Launch: ${parsed.data.name}`,
        summary: parsed.data.description || `Introducing ${parsed.data.name}.`,
        sourceUrl: parsed.data.url || null,
        commitSha: null,
      };
    }
    if (suggestion) {
      const ship = await db.ship.create({
        data: {
          projectId: project.id,
          type: suggestion.type,
          title: suggestion.title,
          summary: suggestion.summary,
          sourceUrl: suggestion.sourceUrl,
          commitSha: suggestion.commitSha,
        },
      });
      firstShipId = ship.id;
      await buildPlan(ship.id);
    }
  } catch (err) {
    console.warn("[onboarding] first-ship analysis failed (page will retry):", err);
  }

  revalidatePath("/app", "layout");
  // Land on the first plan (aha) when we have a ship; else the new-ship form.
  redirect(firstShipId ? `/app/ships/${firstShipId}/plan` : "/app/ships/new");
}

/**
 * Capture interest in private-repo support (coming via a GitHub App). Persists a
 * Lead against the signed-in user's email so we can reach out when it ships.
 * Idempotent enough for our needs — a duplicate lead is harmless.
 */
export async function registerPrivateRepoInterest(): Promise<{ ok: boolean }> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return { ok: false };
  await captureLead({
    email,
    source: "private-repo-interest",
    context: { at: new Date().toISOString() },
  });
  return { ok: true };
}
