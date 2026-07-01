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
  OTHER: "channels",
};

export function platformIcon(platform: string): IconName {
  return PLATFORM_ICON[platform as PlatformValue] ?? "channels";
}
