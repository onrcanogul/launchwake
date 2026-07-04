/**
 * Launch schedule — the D-7 → D+2 run-up around a chosen launch date.
 *
 * Pure + framework-agnostic → unit-testable. Launch-day channels are ordered by
 * their catalog best-times (reusing lib/launchday), the surrounding days are
 * fixed prep/retro milestones. The schedule page renders it; the ICS export and
 * the D-1 reminder are derived from it.
 */

import { buildLaunchTimeline } from "./launchday";
import { buildICSCalendar, type ICSInput } from "./reminders";

export type LaunchMilestoneKind =
  | "prep"
  | "assets"
  | "rehearsal"
  | "launch"
  | "retro"
  | "followup";

export type LaunchChannelSlot = { name: string; timeLabel: string };

export type LaunchMilestone = {
  /** Day offset from launch (0 = launch day). */
  offset: number;
  date: Date;
  kind: LaunchMilestoneKind;
  title: string;
  detail: string;
  /** Ordered channels — launch day only. */
  channels?: LaunchChannelSlot[];
};

export type ScheduleChannel = { name: string; bestTime?: string | null };

function addDaysUTC(base: Date, days: number): Date {
  const d = new Date(base.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/** Midnight-UTC of the launch date (drops any time-of-day). */
function launchDay0(launchDate: Date): Date {
  return new Date(
    Date.UTC(
      launchDate.getUTCFullYear(),
      launchDate.getUTCMonth(),
      launchDate.getUTCDate(),
    ),
  );
}

/**
 * Build the D-7 → D+2 milestones for a launch. Launch-day channels are ordered
 * by best time; every milestone carries an absolute date.
 */
export function buildLaunchSchedule(
  launchDate: Date,
  channels: ScheduleChannel[],
): LaunchMilestone[] {
  const day0 = launchDay0(launchDate);
  const ordered: LaunchChannelSlot[] = buildLaunchTimeline(channels).map((s) => ({
    name: s.rec.name,
    timeLabel: s.timeLabel,
  }));
  const n = channels.length;

  const base: Omit<LaunchMilestone, "date">[] = [
    {
      offset: -7,
      kind: "prep",
      title: "Finalize drafts & install tracking",
      detail:
        "Lock your launch drafts and confirm the tracking snippet fires — attribution is what makes launch day pay off.",
    },
    {
      offset: -3,
      kind: "assets",
      title: "Prepare launch assets",
      detail:
        "Screenshots, a short demo, and the first-comment links you'll drop under each post.",
    },
    {
      offset: -1,
      kind: "rehearsal",
      title: "Rehearsal & reminders",
      detail:
        "Do a dry run and set your launch-day reminders. LaunchWake pings you the day before.",
    },
    {
      offset: 0,
      kind: "launch",
      title: "Launch day",
      detail: `Post to ${n} channel${n === 1 ? "" : "s"} in order — copy each draft, post it yourself, tick it off.`,
      channels: ordered,
    },
    {
      offset: 1,
      kind: "retro",
      title: "Check what converted",
      detail:
        "Review per-channel signups, reply to every comment, and double down where it worked.",
    },
    {
      offset: 2,
      kind: "followup",
      title: "Follow up & share",
      detail:
        "Thank supporters and share your results — your public report is the viral loop.",
    },
  ];

  return base.map((m) => ({ ...m, date: addDaysUTC(day0, m.offset) }));
}

/** Full launch schedule as a multi-event .ics calendar (all milestones). */
export function launchScheduleICS(
  shipId: string,
  shipTitle: string,
  milestones: LaunchMilestone[],
  stamp?: string,
): string {
  const events: ICSInput[] = milestones.map((m) => ({
    uid: `launchwake-launch-${shipId}-${m.offset}@launchwake.dev`,
    title: `${m.title} — ${shipTitle}`,
    description: m.detail,
    start: {
      year: m.date.getUTCFullYear(),
      month: m.date.getUTCMonth() + 1,
      day: m.date.getUTCDate(),
      hour: 9,
      minute: 0,
    },
    durationMinutes: 30,
    stamp,
  }));
  return buildICSCalendar(events);
}
