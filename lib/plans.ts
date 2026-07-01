import { db } from "./db";
import { trackedUrl } from "./attribution";
import type { BanRisk, Platform, ShipType } from "@prisma/client";

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
};

export type ShipWithPlan = {
  ship: {
    id: string;
    type: ShipType;
    title: string;
    summary: string | null;
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
    })) ?? [];

  return {
    ship: {
      id: ship.id,
      type: ship.type,
      title: ship.title,
      summary: ship.summary,
    },
    project: ship.project,
    recs,
  };
}

export type KitRec = {
  id: string;
  channelSlug: string;
  channelName: string;
  platform: Platform;
  ruleNote: string | null;
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
