import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/**
 * Locale-aware navigation primitives. Use these `Link` / `useRouter` /
 * `usePathname` on the marketing surface so links point at the current locale's
 * URL (and never at `/app` or other non-localized routes, which keep `next/link`).
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
