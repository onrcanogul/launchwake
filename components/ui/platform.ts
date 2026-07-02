import type { IconName } from "@/components/Icon";

export type PlatformValue =
  | "HACKERNEWS"
  | "REDDIT"
  | "PRODUCTHUNT"
  | "INDIEHACKERS"
  | "DEVTO"
  | "LOBSTERS"
  | "X"
  | "LINKEDIN"
  | "DISCORD"
  | "SLACK"
  | "NEWSLETTER"
  | "DIRECTORY"
  | "MASTODON"
  | "BLUESKY"
  | "FORUM"
  | "YOUTUBE"
  | "BLOG"
  | "OTHER";

const PLATFORM_ICON: Record<PlatformValue, IconName> = {
  HACKERNEWS: "hn",
  REDDIT: "reddit",
  PRODUCTHUNT: "target",
  INDIEHACKERS: "smile",
  DEVTO: "rules",
  LOBSTERS: "rules",
  X: "x",
  LINKEDIN: "linkedin",
  DISCORD: "discord",
  SLACK: "slack",
  NEWSLETTER: "mail",
  DIRECTORY: "grid",
  MASTODON: "channels",
  BLUESKY: "channels",
  FORUM: "rules",
  YOUTUBE: "youtube",
  BLOG: "rss",
  OTHER: "channels",
};

export function platformIcon(platform: string): IconName {
  return PLATFORM_ICON[platform as PlatformValue] ?? "channels";
}
