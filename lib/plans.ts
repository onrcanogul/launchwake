import { db } from "./db";
import { trackedUrl } from "./attribution";
import {
  parseAccountRequirements,
  type AccountRequirements,
} from "./accountReadiness";
import type { BanRisk, Platform, ShipType, ShipStatus } from "@prisma/client";

export type RecView = {
  id: string;
  channelSlug: string;
  channelName: string;
  platform: Platform;
  audienceDesc: string | null;
  fitScore: number;
  banRisk: BanRisk;
  bestTime: string | null;
  whyText: string;
  ruleNote: string | null;
  outcomeNote: string | null;
  hasDraft: boolean;
  /** Seeded account-readiness data for this channel (null when none). */
  accountRequirements: AccountRequirements | null;
};

export type ShipWithPlan = {
  ship: {
    id: string;
    type: ShipType;
    title: string;
    summary: string | null;
    status: ShipStatus;
    /** Chosen launch date (Launch Mode) — anchors account-readiness timing. */
    launchAt: Date | null;
  };
  project: { id: string; name: string; userId: string };
  recs: RecView[];
};

/** Load a ship, its project, and its ranked recommendations (or null recs). */
export async function getShipWithPlan(
  shipId: string,
  ownerId: string,
): Promise<ShipWithPlan | null> {
  const ship = await db.ship.findFirst({
    where: { id: shipId, project: { userId: ownerId } },
    include: {
      project: { select: { id: true, name: true, userId: true } },
      plan: {
        include: {
          recs: {
            orderBy: [{ rank: "asc" }, { fitScore: "desc" }],
            include: {
              channel: true,
              draft: { select: { id: true } },
            },
          },
        },
      },
    },
  });
  if (!ship) return null;

  const recs: RecView[] =
    ship.plan?.recs.map((r) => ({
      id: r.id,
      channelSlug: r.channel.slug,
      channelName: r.channel.name,
      platform: r.channel.platform,
      audienceDesc: r.channel.audienceDesc,
      fitScore: r.fitScore,
      banRisk: r.banRisk,
      bestTime: r.bestTime,
      whyText: r.whyText,
      ruleNote: r.ruleNote,
      outcomeNote: r.outcomeNote,
      hasDraft: Boolean(r.draft),
      accountRequirements: parseAccountRequirements(r.channel.accountRequirements),
    })) ?? [];

  return {
    ship: {
      id: ship.id,
      type: ship.type,
      title: ship.title,
      summary: ship.summary,
      status: ship.status,
      launchAt: ship.launchAt,
    },
    project: ship.project,
    recs,
  };
}

/**
 * How many distribution plans this account has ever generated. Used to detect
 * the "first plan viewed" activation moment (count === 1) on the plan page.
 */
export async function countAccountPlans(accountId: string): Promise<number> {
  return db.distributionPlan.count({
    where: { ship: { project: { userId: accountId } } },
  });
}

export type KitRec = {
  id: string;
  channelSlug: string;
  channelName: string;
  platform: Platform;
  ruleNote: string | null;
  channelRules: string | null;
  bestTime: string | null;
  draft: { body: string; safetyNote: string | null } | null;
  post: { url: string | null; trackedUrl: string | null } | null;
};

export type ShipKit = {
  ship: { id: string; title: string };
  recs: KitRec[];
};

/** Load a ship's recommendations with their drafts (for the Launch kit tabs). */
export async function getShipKit(
  shipId: string,
  ownerId: string,
): Promise<ShipKit | null> {
  const ship = await db.ship.findFirst({
    where: { id: shipId, project: { userId: ownerId } },
    include: {
      posts: { include: { trackedLink: true } },
      plan: {
        include: {
          recs: {
            orderBy: [{ rank: "asc" }, { fitScore: "desc" }],
            include: { channel: true, draft: true },
          },
        },
      },
    },
  });
  if (!ship) return null;

  const postByChannel = new Map(ship.posts.map((p) => [p.channelId, p]));

  const recs: KitRec[] =
    ship.plan?.recs.map((r) => {
      const post = postByChannel.get(r.channelId);
      return {
        id: r.id,
        channelSlug: r.channel.slug,
        channelName: r.channel.name,
        platform: r.channel.platform,
        ruleNote: r.ruleNote,
        channelRules: r.channel.rules,
        bestTime: r.channel.bestTime,
        draft: r.draft
          ? { body: r.draft.body, safetyNote: r.draft.safetyNote }
          : null,
        post: post
          ? {
              url: post.url,
              trackedUrl: post.trackedLink
                ? trackedUrl(post.trackedLink.shortCode)
                : null,
            }
          : null,
      };
    }) ?? [];

  return { ship: { id: ship.id, title: ship.title }, recs };
}

// ── Launch Day ─────────────────────────────────────────────

export type LaunchStep = {
  id: string;
  channelSlug: string;
  channelName: string;
  platform: Platform;
  audienceDesc: string | null;
  bestTime: string | null;
  banRisk: BanRisk;
  ruleNote: string | null;
  channelRules: string | null;
  draft: { body: string; safetyNote: string | null } | null;
  posted: boolean;
  post: { url: string | null; trackedUrl: string | null } | null;
};

export type ShipLaunch = {
  ship: {
    id: string;
    title: string;
    status: ShipStatus;
    publicToken: string | null;
    publicShowRevenue: boolean;
  };
  steps: LaunchStep[];
};

/**
 * Load a ship's plan as launch-day steps: each recommended channel with its
 * best time, ban risk, draft, and posted/tracked state. The route orders these
 * by time (lib/launchday). Time-ordering is intentionally left to the pure
 * helper so it stays testable.
 */
export async function getLaunchDay(
  shipId: string,
  ownerId: string,
): Promise<ShipLaunch | null> {
  const ship = await db.ship.findFirst({
    where: { id: shipId, project: { userId: ownerId } },
    include: {
      posts: { include: { trackedLink: true } },
      plan: {
        include: {
          recs: {
            orderBy: [{ rank: "asc" }, { fitScore: "desc" }],
            include: { channel: true, draft: true },
          },
        },
      },
    },
  });
  if (!ship) return null;

  const postByChannel = new Map(ship.posts.map((p) => [p.channelId, p]));

  const steps: LaunchStep[] =
    ship.plan?.recs.map((r) => {
      const post = postByChannel.get(r.channelId);
      return {
        id: r.id,
        channelSlug: r.channel.slug,
        channelName: r.channel.name,
        platform: r.channel.platform,
        audienceDesc: r.channel.audienceDesc,
        bestTime: r.bestTime ?? r.channel.bestTime,
        banRisk: r.banRisk,
        ruleNote: r.ruleNote,
        channelRules: r.channel.rules,
        draft: r.draft
          ? { body: r.draft.body, safetyNote: r.draft.safetyNote }
          : null,
        posted: Boolean(post),
        post: post
          ? {
              url: post.url,
              trackedUrl: post.trackedLink
                ? trackedUrl(post.trackedLink.shortCode)
                : null,
            }
          : null,
      };
    }) ?? [];

  return {
    ship: {
      id: ship.id,
      title: ship.title,
      status: ship.status,
      publicToken: ship.publicToken,
      publicShowRevenue: ship.publicShowRevenue,
    },
    steps,
  };
}
