"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Top navigation progress bar (Linear/Vercel style). Dependency-free: it starts
 * on internal link clicks / back-forward that change the pathname, trickles
 * toward 90%, and completes when the new route commits. A 120ms delay before
 * showing avoids flashing on instant (prefetched) navigations.
 */
export function NavProgress() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [width, setWidth] = useState(0);

  const startTimer = useRef<number | null>(null);
  const trickle = useRef<number | null>(null);
  const hideTimers = useRef<number[]>([]);
  const active = useRef(false);
  const firstRun = useRef(true);

  const clearAll = () => {
    if (startTimer.current) window.clearTimeout(startTimer.current);
    if (trickle.current) window.clearInterval(trickle.current);
    hideTimers.current.forEach((t) => window.clearTimeout(t));
    startTimer.current = null;
    trickle.current = null;
    hideTimers.current = [];
  };

  const begin = () => {
    active.current = true;
    setVisible(true);
    setWidth(8);
    trickle.current = window.setInterval(() => {
      setWidth((w) => (w >= 90 ? w : w + (90 - w) * 0.12));
    }, 200);
  };

  const scheduleStart = () => {
    clearAll();
    // Delay so instant navigations don't flash the bar.
    startTimer.current = window.setTimeout(begin, 120);
  };

  const complete = () => {
    clearAll();
    if (!active.current) return; // navigation was instant → never showed
    active.current = false;
    setWidth(100);
    hideTimers.current.push(window.setTimeout(() => setVisible(false), 220));
    hideTimers.current.push(
      window.setTimeout(() => setWidth(0), 480),
    );
  };

  // Trigger on internal, pathname-changing link clicks and history navigation.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      )
        return;
      const anchor = (e.target as HTMLElement | null)?.closest?.("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (
        !href ||
        href.startsWith("#") ||
        anchor.target === "_blank" ||
        anchor.hasAttribute("download")
      )
        return;
      let url: URL;
      try {
        url = new URL(anchor.href, location.href);
      } catch {
        return;
      }
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname) return; // ignore query/hash-only
      scheduleStart();
    };
    const onPopState = () => scheduleStart();

    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
      clearAll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Complete when the route actually changes.
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    complete();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: 2,
        zIndex: 100,
        pointerEvents: "none",
        opacity: visible ? 1 : 0,
        transition: "opacity 0.2s ease",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${width}%`,
          background: "var(--ac)",
          transition: "width 0.2s ease",
        }}
      />
    </div>
  );
}
