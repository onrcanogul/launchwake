"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/Icon";
import { NavProgress } from "@/components/shell/NavProgress";

export type ShipNav = { id: string; title: string } | null;

type NavItem = {
  href: string;
  label: string;
  icon: IconName;
  count?: number;
  /** exact-match only (used for the /app root) */
  exact?: boolean;
};

export type AppShellProps = {
  project: { name: string; subtitle?: string | null };
  user: { name: string; plan: "FREE" | "PRO" };
  shipNav: ShipNav;
  channelsCount?: number;
  /** current page label for the breadcrumb */
  crumb: string;
  children: ReactNode;
};

export function AppShell({
  project,
  user,
  shipNav,
  channelsCount,
  crumb,
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const workspaceNav: NavItem[] = [
    { href: "/app", label: "Ship feed", icon: "grid", exact: true },
    { href: "/app/ships/new", label: "New ship", icon: "plus" },
    {
      href: "/app/channels",
      label: "Channels",
      icon: "channels",
      count: channelsCount,
    },
  ];

  const shipScopedNav: NavItem[] = shipNav
    ? [
        {
          href: `/app/ships/${shipNav.id}/plan`,
          label: "Where to post",
          icon: "where",
        },
        {
          href: `/app/ships/${shipNav.id}/kit`,
          label: "Launch kit",
          icon: "kit",
        },
        { href: "/app/results", label: "Results", icon: "results" },
      ]
    : [];

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

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
    <div className={drawerOpen ? "app drawerbody" : "app"}>
      <NavProgress />
      <div
        className="overlay"
        onClick={() => setDrawerOpen(false)}
        style={drawerOpen ? { display: "block" } : undefined}
      />

      <aside className="side" style={drawerOpen ? { transform: "translateX(0)" } : undefined}>
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

        {shipNav && (
          <>
            <div className="grp" title={shipNav.title}>
              Ship · {truncate(shipNav.title, 16)}
            </div>
            {shipScopedNav.map(renderNav)}
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

        <div className="content">
          {/* keyed on route → replays the entrance animation on each navigation */}
          <div key={pathname} className="lw-page">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
