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

const PLATFORM_LABEL: Record<PlatformValue, string> = {
  HACKERNEWS: "Hacker News",
  REDDIT: "Reddit",
  PRODUCTHUNT: "Product Hunt",
  INDIEHACKERS: "Indie Hackers",
  DEVTO: "DEV.to",
  LOBSTERS: "Lobsters",
  X: "X",
  LINKEDIN: "LinkedIn",
  DISCORD: "Discord",
  SLACK: "Slack",
  NEWSLETTER: "Newsletters",
  DIRECTORY: "Directories",
  MASTODON: "Mastodon",
  BLUESKY: "Bluesky",
  FORUM: "Forums",
  YOUTUBE: "YouTube",
  BLOG: "Blogs",
  OTHER: "Other",
};

/** Human-friendly platform name ("HACKERNEWS" → "Hacker News"). */
export function platformLabel(platform: string): string {
  return PLATFORM_LABEL[platform as PlatformValue] ?? platform;
}
