"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Panel } from "@/components/ui/Panel";
import { Icon } from "@/components/Icon";

type LiveChannel = { name: string; clicks: number; signups: number };

type LiveStats = {
  tracking: boolean;
  totalClicks: number;
  totalSignups: number;
  postsTracked: number;
  lastEventAt: string | null;
  channels: LiveChannel[];
};

const POLL_MS = 15_000;

/** Compact "x ago" for the confirmation line (client-safe, matches Settings). */
function ago(iso: string): string {
  const secs = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 45) return "just now";
  if (secs < 3600) return `${Math.round(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.round(secs / 3600)}h ago`;
  return `${Math.round(secs / 86400)}d ago`;
}

/**
 * Live per-channel click/signup counts for a ship, polled from
 * /api/ships/{id}/live. No websockets — a 15s poll is plenty for attribution,
 * and it confirms "tracking is working" the moment the first event lands.
 */
export function LiveResults({ shipId }: { shipId: string }) {
  const [stats, setStats] = useState<LiveStats | null>(null);
  const [state, setState] = useState<"loading" | "loaded" | "error">("loading");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/ships/${shipId}/live`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as LiveStats;
      setStats(data);
      setState("loaded");
    } catch {
      // Transient — keep any prior data; the next tick retries silently.
      setState((s) => (s === "loading" ? "error" : s));
    }
  }, [shipId]);

  useEffect(() => {
    void load();
    const start = () => {
      if (timer.current) return;
      timer.current = setInterval(() => void load(), POLL_MS);
    };
    const stop = () => {
      if (timer.current) {
        clearInterval(timer.current);
        timer.current = null;
      }
    };
    // Poll only while the tab is visible — refresh immediately on return.
    const onVisibility = () => {
      if (document.hidden) stop();
      else {
        void load();
        start();
      }
    };
    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [load]);

  const right =
    state === "loaded" && stats ? (
      <span className="badge">
        <span
          className="dot"
          style={{ background: stats.tracking ? "var(--ok)" : "var(--tx3)" }}
          aria-hidden
        />
        live
      </span>
    ) : null;

  return (
    <Panel title="Live results" right={right} className="live-results">
      {state === "loading" && !stats ? (
        <div className="track-status">
          <span className="dot" style={{ background: "var(--tx3)" }} aria-hidden />
          Checking for live results…
        </div>
      ) : state === "error" && !stats ? (
        <div className="track-status warn">
          <span className="dot" style={{ background: "var(--warn)" }} aria-hidden />
          Couldn&rsquo;t reach tracking just now — retrying.
        </div>
      ) : stats ? (
        <Body stats={stats} />
      ) : null}
    </Panel>
  );
}

function Body({ stats }: { stats: LiveStats }) {
  // Empty: no tracked links exist yet for this ship.
  if (stats.postsTracked === 0) {
    return (
      <div className="track-status">
        <span className="dot" style={{ background: "var(--tx3)" }} aria-hidden />
        Get a draft, post it with your tracked link, and clicks show up here in
        real time — no reload needed.
      </div>
    );
  }

  // Armed but nothing has fired yet.
  if (!stats.tracking) {
    return (
      <div className="track-status warn">
        <span className="dot" style={{ background: "var(--warn)" }} aria-hidden />
        Tracking armed on <b>{stats.postsTracked}</b> channel
        {stats.postsTracked === 1 ? "" : "s"} — waiting for the first click.
      </div>
    );
  }

  // Loaded + working.
  return (
    <>
      <div className="track-status ok">
        <span className="dot" style={{ background: "var(--ok)" }} aria-hidden />
        Tracking is working — <b>{stats.totalClicks}</b> click
        {stats.totalClicks === 1 ? "" : "s"}
        {stats.totalSignups > 0 ? (
          <>
            {" "}
            and <b>{stats.totalSignups}</b> signup
            {stats.totalSignups === 1 ? "" : "s"}
          </>
        ) : null}{" "}
        so far
        {stats.lastEventAt ? `, last ${ago(stats.lastEventAt)}` : ""}.
      </div>
      <ul className="live-list">
        {stats.channels.map((c) => (
          <li key={c.name}>
            <span className="lc-name">{c.name}</span>
            <span className="lc-stat">
              <Icon name="results" />
              <b>{c.clicks}</b> click{c.clicks === 1 ? "" : "s"}
            </span>
            <span className="lc-stat">
              <b>{c.signups}</b> signup{c.signups === 1 ? "" : "s"}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}
