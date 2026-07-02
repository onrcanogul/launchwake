/**
 * Line icon set — inline SVG, 1.6 stroke, currentColor. NO emoji (design rule).
 * Paths are lifted from /mock/launchwake-app.html so app chrome matches exactly.
 */
import type { SVGProps } from "react";

export type IconName =
  | "grid"
  | "plus"
  | "where"
  | "kit"
  | "results"
  | "channels"
  | "settings"
  | "search"
  | "chevron"
  | "chevronDown"
  | "chevronUpDown"
  | "calendar"
  | "rules"
  | "shield"
  | "copy"
  | "refresh"
  | "github"
  | "external"
  | "link"
  | "rss"
  | "wave"
  | "menu"
  | "check"
  | "arrowRight"
  | "target"
  | "hn"
  | "reddit"
  | "x"
  | "linkedin"
  | "smile"
  | "lock"
  | "mail"
  | "clock"
  | "discord"
  | "slack"
  | "youtube"
  | "rocket";

const PATHS: Record<IconName, React.ReactNode> = {
  grid: <path d="M4 6h16M4 12h16M4 18h16" />,
  plus: <path d="M12 5v14M5 12h14" />,
  where: (
    <>
      <path d="M21 10c0 6-9 12-9 12s-9-6-9-12a9 9 0 0118 0z" />
      <circle cx="12" cy="10" r="3" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4" />
    </>
  ),
  kit: <path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" />,
  results: <path d="M3 3v18h18M7 14l3-3 3 3 5-6" />,
  channels: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19 12a7 7 0 00-.1-1l2-1.5-2-3.4-2.3 1a7 7 0 00-1.7-1l-.3-2.5H10.4l-.3 2.5a7 7 0 00-1.7 1l-2.3-1-2 3.4L6 11a7 7 0 000 2l-2 1.5 2 3.4 2.3-1a7 7 0 001.7 1l.3 2.5h3.2l.3-2.5a7 7 0 001.7-1l2.3 1 2-3.4-2-1.5a7 7 0 00.1-1z" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4-4" />
    </>
  ),
  chevron: <path d="M9 6l6 6-6 6" />,
  chevronDown: <path d="M6 9l6 6 6-6" />,
  chevronUpDown: <path d="M8 9l4-4 4 4M8 15l4 4 4-4" />,
  calendar: (
    <>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 9h18M8 2v4M16 2v4" />
    </>
  ),
  rules: <path d="M4 6h16M4 12h16M4 18h10" />,
  shield: <path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z" />,
  copy: (
    <>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15V5a2 2 0 012-2h10" />
    </>
  ),
  refresh: (
    <path d="M4 12a8 8 0 018-8 8 8 0 016 2.7L21 9M20 12a8 8 0 01-8 8 8 8 0 01-6-2.7L3 15" />
  ),
  github: (
    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.9a3.4 3.4 0 00-.9-2.6c3-.3 6.2-1.5 6.2-6.7A5.2 5.2 0 0019 4.8 4.9 4.9 0 0018.9 1S17.7.6 15 2.5a13 13 0 00-6 0C6.3.6 5.1 1 5.1 1A4.9 4.9 0 005 4.8a5.2 5.2 0 00-1.4 3.6c0 5.2 3.2 6.4 6.2 6.7a3.4 3.4 0 00-.9 2.6V22" />
  ),
  external: (
    <>
      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
      <path d="M15 3h6v6M10 14L21 3" />
    </>
  ),
  link: (
    <path d="M10 13a5 5 0 007 0l3-3a5 5 0 00-7-7l-1.5 1.5M14 11a5 5 0 00-7 0l-3 3a5 5 0 007 7l1.5-1.5" />
  ),
  rss: (
    <>
      <path d="M4 4h16v16H4z" />
      <path d="M8 9h8M8 13h5" />
    </>
  ),
  wave: (
    <>
      <path
        d="M2 15c2.2 0 2.2-3 4.4-3s2.2 3 4.4 3 2.2-3 4.4-3 2.2 3 4.4 3"
        stroke="#3ECFB6"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M2 19c2.2 0 2.2-2.4 4.4-2.4s2.2 2.4 4.4 2.4 2.2-2.4 4.4-2.4 2.2 2.4 4.4 2.4"
        stroke="#2a5bd7"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity=".7"
      />
    </>
  ),
  menu: <path d="M3 6h18M3 12h18M3 18h18" />,
  check: <path d="M4 12l5 5L20 6" />,
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
  hn: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 12h6" />
    </>
  ),
  reddit: <path d="M4 4h16v12H5l-1 4z" />,
  x: <path d="M4 4l7 8-7 8M13 4h7l-7 8 7 8h-7" />,
  linkedin: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M7 10v7M7 7v.01M12 17v-4a2 2 0 014 0v4" />
    </>
  ),
  smile: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 13s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" />
    </>
  ),
  lock: (
    <>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 018 0v4" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  discord: (
    <>
      <path d="M8.5 6.5c2-0.8 5-0.8 7 0" />
      <path d="M8 7c-2 3-2.4 8-1.5 11.5M16 7c2 3 2.4 8 1.5 11.5" />
      <circle cx="9.5" cy="13" r="1" />
      <circle cx="14.5" cy="13" r="1" />
    </>
  ),
  slack: (
    <>
      <path d="M9 4v9M13 7.5v9M4.5 11h9M7.5 8h9" />
    </>
  ),
  youtube: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="3" />
      <path d="M10.5 9.2l4.5 2.8-4.5 2.8z" />
    </>
  ),
  rocket: (
    <>
      <path d="M5 15c-1 1-1.5 4-1.5 4s3-.5 4-1.5" />
      <path d="M9 15l-3-3c1-5 5-9 10-9 0 5-4 9-9 10l-3 3" />
      <circle cx="14.5" cy="9.5" r="1.5" />
    </>
  ),
};

type IconProps = SVGProps<SVGSVGElement> & {
  name: IconName;
  size?: number;
};

export function Icon({ name, size, ...props }: IconProps) {
  const style = size ? { width: size, height: size, ...props.style } : props.style;
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props} style={style}>
      {PATHS[name]}
    </svg>
  );
}
