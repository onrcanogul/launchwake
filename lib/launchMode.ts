import { db } from "./db";
import { getTrackingStatus, type TrackingStatus } from "./attribution";
import { computeReadiness, type ReadinessResult } from "./launchReadiness";
import type { LaunchStage, ShipStatus } from "@prisma/client";

/**
 * Launch Mode — the guided first-launch flow for PRE_LAUNCH / UNANNOUNCED
 * products. It threads through existing ship-scoped routes (plan, kit, launch)
 * plus new readiness / schedule / retro stages, tied together by a stepper.
 *
 * This module owns the stage metadata and a single state gatherer so every
 * stage page renders a consistent rail without duplicating queries.
 */

export type LaunchStageKey =
  | "readiness"
  | "plan"
  | "kit"
  | "schedule"
  | "launch"
  | "retro";

export type LaunchModeStageMeta = {
  key: LaunchStageKey;
  label: string;
  /** Icon name (resolved by the rail component). */
  icon: string;
};

/** Ordered Launch Mode stages (the guided path). */
export const LAUNCH_MODE_STAGES: LaunchModeStageMeta[] = [
  { key: "readiness", label: "Readiness", icon: "shield" },
  { key: "plan", label: "Where to post", icon: "where" },
  { key: "kit", label: "Launch kit", icon: "kit" },
  { key: "schedule", label: "Schedule", icon: "calendar" },
  { key: "launch", label: "Launch day", icon: "rocket" },
  { key: "retro", label: "Retro", icon: "results" },
];

/** Whether a project is in Launch Mode (not yet launched). */
export function isLaunchMode(launchStage: LaunchStage): boolean {
  return launchStage !== "LAUNCHED";
}

/** Route for a stage of a given ship. */
export function launchStagePath(shipId: string, key: LaunchStageKey): string {
  const suffix: Record<LaunchStageKey, string> = {
    readiness: "readiness",
    plan: "plan",
    kit: "kit",
    schedule: "schedule",
    launch: "launch",
    retro: "retro",
  };
  return `/app/ships/${shipId}/${suffix[key]}`;
}

export type StageState = LaunchModeStageMeta & {
  href: string;
  done: boolean;
  current: boolean;
};

export type LaunchModeState = {
  ship: {
    id: string;
    title: string;
    status: ShipStatus;
    launchAt: Date | null;
    publicToken: string | null;
    publicShowRevenue: boolean;
  };
  project: {
    id: string;
    name: string;
    url: string | null;
    description: string | null;
    launchStage: LaunchStage;
  };
  readiness: ReadinessResult;
  /** Attribution status (for the tracking-setup card on the readiness stage). */
  tracking: TrackingStatus;
  stripeSecretSet: boolean;
  /** Last pixel verification ping (null until the snippet goes live). */
  pixelVerifiedAt: Date | null;
  channelCount: number;
  draftCount: number;
  postedCount: number;
  reminderCount: number;
  stages: StageState[];
  /** First incomplete stage — where the "continue" CTA points. */
  nextKey: LaunchStageKey;
};

/**
 * Gather the Launch Mode state for a ship (ownership-scoped), compute + persist
 * the readiness snapshot, and derive per-stage completion. `current` marks the
 * stage the page is on.
 */
export async function getLaunchModeState(
  shipId: string,
  ownerId: string,
  current: LaunchStageKey,
): Promise<LaunchModeState | null> {
  const ship = await db.ship.findFirst({
    where: { id: shipId, project: { userId: ownerId } },
    include: {
      project: true,
      posts: { select: { channelId: true } },
      plan: {
        include: {
          recs: { include: { draft: { select: { id: true } } } },
        },
      },
    },
  });
  if (!ship) return null;

  const recs = ship.plan?.recs ?? [];
  const channelCount = recs.length;
  const draftCount = recs.filter((r) => r.draft).length;
  const postedChannels = new Set(ship.posts.map((p) => p.channelId));
  const postedCount = recs.filter((r) => postedChannels.has(r.channelId)).length;

  const [tracking, reminderCount] = await Promise.all([
    getTrackingStatus(ship.project.id),
    db.reminder.count({ where: { shipId } }),
  ]);
  // A verify ping or an attributed signup proves the snippet; clicks alone
  // don't (they go through the /r/ redirect and never touch the pixel), but we
  // keep them as a legacy signal for pre-pixel installs of the inline snippet.
  const trackingLive =
    ship.project.pixelVerifiedAt !== null ||
    tracking.clicks > 0 ||
    tracking.signups > 0;

  const scheduled = ship.launchAt !== null || reminderCount > 0;
  const readiness = computeReadiness({
    trackingLive,
    hasProductUrl: Boolean(ship.project.url),
    hasDescription: (ship.project.description?.trim().length ?? 0) >= 12,
    hasPlan: channelCount > 0,
    channelCount,
    draftCount,
    scheduled,
  });

  // Persist the snapshot only when it actually changed — avoids a write on every
  // page render (and the race between concurrent loads). Best-effort: a write
  // hiccup must not break the page.
  const snapshot = {
    score: readiness.score,
    ready: readiness.ready,
    items: readiness.items,
  };
  if (JSON.stringify(ship.project.launchReadinessJson) !== JSON.stringify(snapshot)) {
    await db.project
      .update({
        where: { id: ship.project.id },
        data: { launchReadinessJson: snapshot, launchReadinessAt: new Date() },
      })
      .catch(() => {});
  }

  const done: Record<LaunchStageKey, boolean> = {
    readiness: readiness.ready,
    plan: channelCount > 0,
    kit: draftCount > 0,
    schedule: scheduled,
    launch: channelCount > 0 && postedCount === channelCount,
    retro: ship.project.launchStage === "LAUNCHED",
  };

  const stages: StageState[] = LAUNCH_MODE_STAGES.map((s) => ({
    ...s,
    href: launchStagePath(shipId, s.key),
    done: done[s.key],
    current: s.key === current,
  }));

  const nextKey =
    LAUNCH_MODE_STAGES.find((s) => !done[s.key])?.key ?? "retro";

  return {
    ship: {
      id: ship.id,
      title: ship.title,
      status: ship.status,
      launchAt: ship.launchAt,
      publicToken: ship.publicToken,
      publicShowRevenue: ship.publicShowRevenue,
    },
    project: {
      id: ship.project.id,
      name: ship.project.name,
      url: ship.project.url,
      description: ship.project.description,
      launchStage: ship.project.launchStage,
    },
    readiness,
    tracking,
    stripeSecretSet: Boolean(ship.project.stripeWebhookSecret),
    pixelVerifiedAt: ship.project.pixelVerifiedAt,
    channelCount,
    draftCount,
    postedCount,
    reminderCount,
    stages,
    nextKey,
  };
}
