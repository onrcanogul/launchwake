import { db } from "./db";
import { matchChannels } from "./channels";
import type { BanRisk, Platform, Project } from "@prisma/client";

export type DirectoryRow = {
  slug: string;
  name: string;
  platform: Platform;
  fit: number;
  banRisk: BanRisk;
  bestTime: string | null;
  signups: number | null;
};

/**
 * The channel directory for a project: the catalog ranked by fit to the product,
 * annotated with the user's own signups per channel (the flywheel view).
 */
export async function getChannelDirectory(
  project: Pick<Project, "id" | "name" | "description" | "url">,
): Promise<DirectoryRow[]> {
  const catalog = await db.channel.findMany();

  const scored = matchChannels(
    catalog,
    {
      projectText: `${project.name} ${project.description ?? ""} ${project.url ?? ""}`,
      shipText: "",
      shipType: "OTHER",
    },
    catalog.length,
  );

  // Signups per channel for this project (via posts → tracked link → events).
  const signupRows = await db.event.groupBy({
    by: ["trackedLinkId"],
    where: {
      type: "SIGNUP",
      trackedLink: { post: { ship: { projectId: project.id } } },
    },
    _count: { _all: true },
  });
  const hasAnySignups = signupRows.length > 0;

  const top = scored[0]?.score ?? 0;
  return scored.map((s) => {
    const norm = top > 0 ? s.score / top : 0;
    const fit = Math.round(55 + norm * 41);
    return {
      slug: s.channel.slug,
      name: s.channel.name,
      platform: s.channel.platform,
      fit,
      banRisk: s.channel.defaultBanRisk,
      bestTime: s.channel.bestTime,
      // Until attribution lands (M2) we show "—"; keep the column meaningful.
      signups: hasAnySignups ? 0 : null,
    };
  });
}
