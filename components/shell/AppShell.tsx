"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/Icon";
import { NavProgress } from "@/components/shell/NavProgress";
import {
  SidebarShipSwitcher,
  type SwitcherShip,
} from "@/components/shell/SidebarShipSwitcher";

type NavItem = {
  href: string;
  label: string;
  icon: IconName;
  count?: number;
  /** exact-match only (used for the /app root) */
  exact?: boolean;
  /** custom active predicate (used for bare + id-scoped ship routes) */
  match?: (pathname: string) => boolean;
};

export type AppShellProps = {
  project: { name: string; subtitle?: string | null };
  user: { name: string; plan: "FREE" | "PRO" };
  /** All ships (for the sidebar switcher). */
  ships: SwitcherShip[];
  /** The ship in context — the URL ship on ship pages, else the cookie's. */
  activeShip: { id: string; title: string } | null;
  channelsCount?: number;
  children: ReactNode;
};

function crumbFor(pathname: string): string {
  if (pathname === "/app") return "Ship feed";
  if (pathname.startsWith("/app/ships/new")) return "New ship";
  if (pathname.startsWith("/app/channels")) return "Channels";
  if (pathname.startsWith("/app/results")) return "Results";
  if (pathname.startsWith("/app/settings")) return "Settings";
  if (pathname === "/app/plan" || pathname.endsWith("/plan"))
    return "Where to post";
  if (pathname === "/app/kit" || pathname.endsWith("/kit")) return "Launch kit";
  return "";
}

export function AppShell({
  project,
  user,
  ships,
  activeShip,
  channelsCount,
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const crumb = crumbFor(pathname);

  // The shell is persistent now, so close the mobile drawer whenever the route
  // changes (nav link, ship switcher, back/forward — anything).
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Workspace = project-wide screens (unaffected by the active ship).
  const workspaceNav: NavItem[] = [
    { href: "/app", label: "Ship feed", icon: "grid", exact: true },
    { href: "/app/ships/new", label: "New ship", icon: "plus" },
    {
      href: "/app/channels",
      label: "Channels",
      icon: "channels",
      count: channelsCount,
    },
    { href: "/app/results", label: "Results", icon: "results" },
  ];

  // Ship-scoped screens point at bare routes that resolve to the active ship
  // (or show a "select a ship" prompt).
  const shipNavItems: NavItem[] = [
    {
      href: "/app/plan",
      label: "Where to post",
      icon: "where",
      match: (p) => p === "/app/plan" || p.endsWith("/plan"),
    },
    {
      href: "/app/kit",
      label: "Launch kit",
      icon: "kit",
      match: (p) => p === "/app/kit" || p.endsWith("/kit"),
    },
  ];

  const isActive = (item: NavItem) =>
    item.match
      ? item.match(pathname)
      : item.exact
        ? pathname === item.href
        : pathname.startsWith(item.href);

  const renderNav = (item: NavItem) => (
    <Link
      key={item.href}
      href={item.href}
      className={["nav", isActive(item) ? "on" : ""].join(" ")}
      onClick={() => setDrawerOpen(false)}
    >
      <Icon name={item.icon} />
      {item.label}
      {item.count !== undefined && <span className="cnt">{item.count}</span>}
    </Link>
  );

  return (
    <div className="app">
      <NavProgress />
      <div
        className="overlay"
        onClick={() => setDrawerOpen(false)}
        style={drawerOpen ? { display: "block" } : undefined}
      />

      <aside
        className="side"
        style={drawerOpen ? { transform: "translateX(0)" } : undefined}
      >
        <div className="brand">
          <Icon name="wave" /> LaunchWake
        </div>

        <div className="ws">
          <div className="sq">{project.name.charAt(0).toUpperCase()}</div>
          <div className="nm">
            <b>{project.name}</b>
            {project.subtitle && <span>{project.subtitle}</span>}
          </div>
          <Icon name="chevronUpDown" size={13} style={{ stroke: "var(--tx3)" }} />
        </div>

        <div className="grp">Workspace</div>
        {workspaceNav.map(renderNav)}

        {ships.length > 0 && (
          <>
            <SidebarShipSwitcher
              ships={ships}
              activeId={activeShip?.id ?? null}
            />
            {shipNavItems.map(renderNav)}
          </>
        )}

        <div className="sp" />
        {renderNav({ href: "/app/settings", label: "Settings", icon: "settings" })}
        <div className="usr">
          <div className="av">{user.name.charAt(0).toUpperCase()}</div>
          <div className="nm">
            <b>{user.name}</b>
            <span>
              {user.plan === "PRO" ? "Pro plan" : "Free plan"} ·{" "}
              <Link href="/app/settings" style={{ color: "var(--ac)" }}>
                {user.plan === "PRO" ? "Manage" : "Upgrade"}
              </Link>
            </span>
          </div>
        </div>
      </aside>

      <div className="main">
        <div className="bar">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              className="burger"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
            >
              <Icon name="menu" />
            </button>
            <div className="crumb">
              <span>{project.name}</span>
              <Icon name="chevron" />
              <b id="crumb">{crumb}</b>
            </div>
          </div>
          <div className="search">
            <Icon name="search" /> Search<span className="kbd">⌘K</span>
          </div>
        </div>

        <div className="content" id="main">
          {/* keyed on route → replays the entrance animation on each navigation */}
          <div key={pathname} className="lw-page">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
