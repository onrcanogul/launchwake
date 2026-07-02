import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { buildPlan } from "@/lib/analysis";
import { buildPlanComment } from "@/lib/actionComment";
import type { ShipType } from "@prisma/client";

/**
 * Action-facing endpoint. The LaunchWake GitHub Action posts a release/PR here;
 * we build the distribution plan and return the comment markdown for the Action
 * to post back. Authenticated by the project's webhook secret (Bearer) — the
 * same one used for the auto-detect webhook.
 */

const BodySchema = z.object({
  repo: z.string().min(1),
  kind: z.enum(["release", "pull_request", "other"]).default("release"),
  title: z.string().min(1).max(300),
  summary: z.string().max(5000).nullish(),
  sourceUrl: z.string().url().nullish(),
  commitSha: z.string().max(80).nullish(),
});

function shipType(kind: string, title: string): ShipType {
  if (kind === "release") {
    return /\b(v?1\.0|beta|launch|ga)\b/i.test(title) ? "LAUNCH" : "FEATURE";
  }
  return "FEATURE";
}

export async function POST(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return NextResponse.json({ error: "Missing API key (Authorization: Bearer …)." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Provide repo + title." }, { status: 400 });
  }
  const input = parsed.data;

  const project = await db.project.findFirst({
    where: { githubRepo: { equals: input.repo, mode: "insensitive" } },
  });
  if (!project || !project.webhookSecret || project.webhookSecret !== token) {
    // Same response for missing project / bad key — don't leak which repos exist.
    return NextResponse.json({ error: "Repo not connected or API key invalid." }, { status: 401 });
  }

  // Dedupe: reuse the ship the webhook may have already created for this release.
  const existing = await db.ship.findFirst({
    where: {
      projectId: project.id,
      OR: [
        ...(input.sourceUrl ? [{ sourceUrl: input.sourceUrl }] : []),
        ...(input.commitSha ? [{ commitSha: input.commitSha }] : []),
      ],
    },
    include: { plan: { select: { id: true } } },
    orderBy: { detectedAt: "desc" },
  });

  const ship =
    existing ??
    (await db.ship.create({
      data: {
        projectId: project.id,
        type: shipType(input.kind, input.title),
        title: input.title,
        summary: input.summary ?? null,
        sourceUrl: input.sourceUrl ?? null,
        commitSha: input.commitSha ?? null,
      },
      include: { plan: { select: { id: true } } },
    }));

  // Ensure a plan exists (build if the ship is new or was never analyzed).
  if (!ship.plan) {
    try {
      await buildPlan(ship.id);
    } catch (err) {
      return NextResponse.json(
        { error: `Couldn't build the plan: ${(err as Error).message}` },
        { status: 502 },
      );
    }
  }

  const recs = await db.recommendation.findMany({
    where: { plan: { shipId: ship.id } },
    orderBy: [{ rank: "asc" }, { fitScore: "desc" }],
    include: { channel: { select: { name: true } } },
  });

  const planUrl = `${env.APP_URL.replace(/\/$/, "")}/app/ships/${ship.id}/plan`;
  const comment = buildPlanComment({
    shipTitle: ship.title,
    channelCount: recs.length,
    topChannels: recs.slice(0, 3).map((r) => r.channel.name),
    planUrl,
    appUrl: env.APP_URL,
  });

  return NextResponse.json({ ok: true, shipId: ship.id, planUrl, channelCount: recs.length, comment });
}
