"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/Icon";
import { DemoBanner } from "@/components/demo/DemoBanner";
import { DEMO_PROJECT, DEMO_SHIP, DEMO_CHANNEL_TOTAL } from "@/lib/demoData";

/**
 * A visual twin of `components/shell/AppShell.tsx` for the public `/demo` tour.
 * Same CSS classes and nav so it's indistinguishable from the real app shell, but
 * every link points into `/demo`, the project/ship switchers are inert static
 * pills, and there's no ⌘K palette — the demo never touches session or DB. Keeping
 * this separate leaves the production `AppShell` (and its interactive children)
 * untouched.
 */

const START_HREF = `/login?callbackUrl=${encodeURIComponent("/onboarding")}`;

type NavItem = {
  href: string;
  label: string;
  icon: IconName;
  count?: number;
  exact?: boolean;
  /** Shown greyed-out and non-interactive (creating a ship needs a real account). */
  disabled?: boolean;
};

const WORKSPACE_NAV: NavItem[] = [
  { href: "/demo", label: "Ship feed", icon: "grid", exact: true },
  { href: "#", label: "New ship", icon: "plus", disabled: true },
  { href: "/demo/channels", label: "Channels", icon: "channels", count: DEMO_CHANNEL_TOTAL },
  { href: "/demo/radar", label: "Intent Radar", icon: "target" },
  { href: "/demo/results", label: "Results", icon: "results" },
];

const SHIP_NAV: NavItem[] = [
  { href: "/demo/plan", label: "Where to post", icon: "where" },
  { href: "/demo/kit", label: "Launch kit", icon: "kit" },
  { href: "/demo/queue", label: "Queue", icon: "calendar" },
  { href: "/demo/pitches", label: "Newsletters", icon: "mail" },
  { href: "/demo/launch", label: "Launch day", icon: "rocket" },
];

function crumbFor(pathname: string): string {
  if (pathname === "/demo") return "Ship feed";
  if (pathname.startsWith("/demo/channels")) return "Channels";
  if (pathname.startsWith("/demo/radar")) return "Intent Radar";
  if (pathname.startsWith("/demo/results")) return "Results";
  if (pathname.startsWith("/demo/plan")) return "Where to post";
  if (pathname.startsWith("/demo/kit")) return "Launch kit";
  if (pathname.startsWith("/demo/queue")) return "Queue";
  if (pathname.startsWith("/demo/pitches")) return "Newsletters";
  if (pathname.startsWith("/demo/launch")) return "Launch day";
  if (pathname.startsWith("/demo/settings")) return "Settings";
  return "";
}

export function DemoShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  const isActive = (item: NavItem) =>
    item.exact
      ? pathname === item.href
      : pathname === item.href || pathname.startsWith(`${item.href}/`);

  const renderNav = (item: NavItem) => {
    if (item.disabled) {
      return (
        <span
          key={item.label}
          className="nav nav-off"
          aria-disabled="true"
          title="Creating a ship needs a real account"
        >
          <Icon name={item.icon} />
          {item.label}
        </span>
      );
    }
    return (
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
  };

  return (
    <div className="app">
      <div
        className="overlay"
        onClick={() => setDrawerOpen(false)}
        style={drawerOpen ? { display: "block" } : undefined}
      />

      <aside className="side" style={drawerOpen ? { transform: "translateX(0)" } : undefined}>
        <div className="brand">
          <Image src="/logo.png" alt="LaunchWake" width={24} height={24} className="brand-logo" priority />
          LaunchWake
        </div>

        {/* Inert project header (mirrors ProjectSwitcher's trigger markup) */}
        <div className="pswitch">
          <div className="ws" title="Demo workspace">
            <div className="sq">{DEMO_PROJECT.name.charAt(0)}</div>
            <div className="nm">
              <b>{DEMO_PROJECT.name}</b>
              <span>{DEMO_PROJECT.subtitle}</span>
            </div>
          </div>
        </div>

        <div className="grp">Workspace</div>
        {WORKSPACE_NAV.map(renderNav)}

        {/* Inert ship header (mirrors SidebarShipSwitcher's trigger markup) */}
        <div className="shipsw shipgrp">
          <div className="shipgrp-trigger" style={{ cursor: "default" }}>
            <span className="lbl">
              Ship · <b>{DEMO_SHIP.title}</b>
            </span>
          </div>
        </div>
        {SHIP_NAV.map(renderNav)}

        <div className="sp" />
        {renderNav({ href: "/demo/settings", label: "Settings", icon: "settings" })}
        <div className="usr">
          <div className="av">G</div>
          <div className="nm">
            <b>Guest</b>
            <span>
              Demo ·{" "}
              <Link href={START_HREF} style={{ color: "var(--ac)" }}>
                Start free
              </Link>
            </span>
          </div>
        </div>
      </aside>

      <div className="main">
        <DemoBanner />
        <div className="bar">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button className="burger" onClick={() => setDrawerOpen(true)} aria-label="Open menu">
              <Icon name="menu" />
            </button>
            <div className="crumb">
              <span>{DEMO_PROJECT.name}</span>
              <Icon name="chevron" />
              <b>{crumbFor(pathname)}</b>
            </div>
          </div>
          <Link href={START_HREF} className="btn btn-s" style={{ height: 32 }}>
            <Icon name="arrowRight" />
            Start free
          </Link>
        </div>

        <div className="content" id="main">
          <div key={pathname} className="lw-page">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
