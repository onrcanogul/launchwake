"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/Icon";
import { sectionRest } from "@/lib/appRoutes";
import { NavProgress } from "@/components/shell/NavProgress";
import {
  SidebarShipSwitcher,
  type SwitcherShip,
} from "@/components/shell/SidebarShipSwitcher";
import {
  ProjectSwitcher,
  type ProjectOption,
} from "@/components/shell/ProjectSwitcher";

type NavItem = {
  href: string;
  label: string;
  icon: IconName;
  count?: number;
  /** exact-match only (used for the project root/feed) */
  exact?: boolean;
  /** custom active predicate over the path AFTER the /app/[project] prefix */
  match?: (rest: string) => boolean;
};

export type AppShellProps = {
  /** The project named in the URL — every nav href is scoped to it. */
  projectId: string;
  project: { name: string; subtitle?: string | null };
  /** All of the account's projects (drives the switcher when there are 2+). */
  projects: ProjectOption[];
  user: { name: string; plan: "FREE" | "PRO" | "TEAM" };
  /** This project's ships (for the sidebar ship switcher). */
  ships: SwitcherShip[];
  /** The ship in context — the URL ship on ship pages, else the cookie's. */
  activeShip: { id: string; title: string } | null;
  channelsCount?: number;
  children: ReactNode;
};

function crumbFor(rest: string): string {
  if (rest === "") return "Ship feed";
  if (rest.startsWith("/ships/new")) return "New ship";
  if (rest.startsWith("/channels")) return "Channels";
  if (rest.startsWith("/radar")) return "Intent Radar";
  if (rest.startsWith("/results")) return "Results";
  if (rest.startsWith("/settings")) return "Settings";
  if (rest === "/plan" || rest.endsWith("/plan")) return "Where to post";
  if (rest === "/kit" || rest.endsWith("/kit")) return "Launch kit";
  if (rest === "/queue" || rest.endsWith("/queue")) return "Queue";
  if (rest === "/pitches" || rest.endsWith("/pitches")) return "Newsletters";
  if (rest.endsWith("/readiness")) return "Launch readiness";
  if (rest.endsWith("/schedule")) return "Schedule";
  if (rest.endsWith("/retro")) return "Launch retro";
  if (rest === "/launch" || rest.endsWith("/launch")) return "Launch day";
  return "";
}

export function AppShell({
  projectId,
  project,
  projects,
  user,
  ships,
  activeShip,
  channelsCount,
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const rest = sectionRest(pathname);
  const crumb = crumbFor(rest);
  const base = `/app/${projectId}`;

  // The shell is persistent, so close the mobile drawer whenever the route
  // changes (nav link, switcher, back/forward — anything).
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Workspace = project-wide screens (unaffected by the active ship).
  const workspaceNav: NavItem[] = [
    { href: base, label: "Ship feed", icon: "grid", exact: true },
    { href: `${base}/ships/new`, label: "New ship", icon: "plus" },
    {
      href: `${base}/channels`,
      label: "Channels",
      icon: "channels",
      count: channelsCount,
    },
    { href: `${base}/radar`, label: "Intent Radar", icon: "target" },
    { href: `${base}/results`, label: "Results", icon: "results" },
  ];

  // Ship-scoped screens. When a ship is in context we link STRAIGHT to its
  // id-scoped route (e.g. /app/<proj>/ships/xyz/plan) so the click is a single
  // soft navigation Next can prefetch — instead of the bare /app/<proj>/plan
  // page, which server-redirects (an extra, un-prefetchable round trip). With no
  // active ship we fall back to the bare route (the "select a ship" prompt).
  const shipBase = activeShip ? `${base}/ships/${activeShip.id}` : null;
  const shipNavItems: NavItem[] = [
    {
      href: shipBase ? `${shipBase}/plan` : `${base}/plan`,
      label: "Where to post",
      icon: "where",
      match: (r) => r === "/plan" || r.endsWith("/plan"),
    },
    {
      href: shipBase ? `${shipBase}/kit` : `${base}/kit`,
      label: "Launch kit",
      icon: "kit",
      match: (r) => r === "/kit" || r.endsWith("/kit"),
    },
    {
      href: shipBase ? `${shipBase}/queue` : `${base}/queue`,
      label: "Queue",
      icon: "calendar",
      match: (r) => r === "/queue" || r.endsWith("/queue"),
    },
    {
      href: shipBase ? `${shipBase}/pitches` : `${base}/pitches`,
      label: "Newsletters",
      icon: "mail",
      match: (r) => r === "/pitches" || r.endsWith("/pitches"),
    },
    {
      href: shipBase ? `${shipBase}/launch` : `${base}/launch`,
      label: "Launch day",
      icon: "rocket",
      match: (r) => r === "/launch" || r.endsWith("/launch"),
    },
  ];

  const isActive = (item: NavItem) =>
    item.match
      ? item.match(rest)
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
          <Image
            src="/logo.png"
            alt="LaunchWake"
            width={24}
            height={24}
            className="brand-logo"
            priority
          />
          LaunchWake
        </div>

        <ProjectSwitcher
          projects={projects}
          currentId={projectId}
          current={project}
        />

        <div className="grp">Workspace</div>
        {workspaceNav.map(renderNav)}

        {ships.length > 0 && (
          <>
            <SidebarShipSwitcher
              projectId={projectId}
              ships={ships}
              activeId={activeShip?.id ?? null}
            />
            {shipNavItems.map(renderNav)}
          </>
        )}

        <div className="sp" />
        {renderNav({ href: `${base}/settings`, label: "Settings", icon: "settings" })}
        <div className="usr">
          <div className="av">{user.name.charAt(0).toUpperCase()}</div>
          <div className="nm">
            <b>{user.name}</b>
            <span>
              {user.plan === "TEAM"
                ? "Team plan"
                : user.plan === "PRO"
                  ? "Pro plan"
                  : "Free plan"}{" "}
              ·{" "}
              <Link href={`${base}/settings`} style={{ color: "var(--ac)" }}>
                {user.plan === "FREE" ? "Upgrade" : "Manage"}
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
