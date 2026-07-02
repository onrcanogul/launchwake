/**
 * Launch Day — turn a distribution plan into a single time-ordered run sheet.
 *
 * The catalog stores human bestTime strings ("Tue–Thu 8am ET", "Tue 00:01 PT",
 * "Weekly (Friday)", "Anytime (queued)"). This orders the day's channels by when
 * to post them: clock-timed slots first (earliest → latest), then the
 * scheduled-but-not-clock-timed and anytime ones. Pure → unit-testable; the UI
 * groups the result into windows and renders a checklist.
 */

export type LaunchWindow =
  | "early"
  | "morning"
  | "midday"
  | "afternoon"
  | "evening"
  | "flexible";

export type TimelineStep<R> = {
  rec: R;
  /** Ascending sort key: minutes-into-day for timed slots, larger for flexible. */
  order: number;
  /** Display label: a clock time ("8:00 AM ET") or the original phrase. */
  timeLabel: string;
  window: LaunchWindow;
};

/** Windows in display order, with human headers. */
export const WINDOW_ORDER: LaunchWindow[] = [
  "early",
  "morning",
  "midday",
  "afternoon",
  "evening",
  "flexible",
];

export const WINDOW_LABEL: Record<LaunchWindow, string> = {
  early: "Early (before 8am)",
  morning: "Morning",
  midday: "Midday",
  afternoon: "Afternoon",
  evening: "Evening",
  flexible: "Anytime / scheduled",
};

const TZ_RE = /\b(ET|EST|EDT|PT|PST|PDT|CT|CST|CDT|MT|MST|MDT|GMT|UTC|BST|CET|CEST)\b/i;

/** Parse the first clock time in the string, or null if there's none. */
function parseClock(text: string): { hour: number; minute: number } | null {
  const m = text.match(/\b(\d{1,2}):(\d{2})\s*(am|pm)?\b/i) ?? text.match(/\b(\d{1,2})\s*(am|pm)\b/i);
  if (!m) {
    // "morning"/"mornings" with no digit → treat as 9am.
    if (/\bmorning/i.test(text)) return { hour: 9, minute: 0 };
    return null;
  }
  let hour = parseInt(m[1], 10);
  const hasColon = m[2] !== undefined && /^\d{2}$/.test(m[2] ?? "");
  const minute = hasColon ? parseInt(m[2]!, 10) : 0;
  const mer = (hasColon ? m[3] : m[2])?.toLowerCase();
  if (mer === "pm" && hour < 12) hour += 12;
  if (mer === "am" && hour === 12) hour = 0;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

function windowFor(hour: number): LaunchWindow {
  if (hour < 8) return "early";
  if (hour < 12) return "morning";
  if (hour < 14) return "midday";
  if (hour < 18) return "afternoon";
  return "evening";
}

function fmtClock(hour: number, minute: number): string {
  const mer = hour < 12 ? "AM" : "PM";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  const mm = minute.toString().padStart(2, "0");
  return `${h12}:${mm} ${mer}`;
}

/** Tidy an untimed phrase for display ("Anytime (queued)" stays as-is). */
function flexibleLabel(bestTime: string | null | undefined): string {
  const s = (bestTime ?? "").trim();
  return s.length > 0 ? s : "Anytime";
}

/**
 * Order a plan's channels into a launch-day run sheet. `recs` keep their incoming
 * (rank) order within the flexible group so ties stay stable.
 */
export function buildLaunchTimeline<R extends { bestTime?: string | null }>(
  recs: R[],
): TimelineStep<R>[] {
  return recs
    .map((rec, index) => {
      const bestTime = rec.bestTime ?? null;
      const clock = bestTime ? parseClock(bestTime) : null;
      if (clock) {
        const tz = bestTime!.match(TZ_RE)?.[0]?.toUpperCase();
        const label = `${fmtClock(clock.hour, clock.minute)}${tz ? ` ${tz}` : ""}`;
        return {
          rec,
          order: clock.hour * 60 + clock.minute,
          timeLabel: label,
          window: windowFor(clock.hour),
        } satisfies TimelineStep<R>;
      }
      // No clock time → flexible bucket, preserving incoming order.
      return {
        rec,
        order: 24 * 60 + index,
        timeLabel: flexibleLabel(bestTime),
        window: "flexible" as const,
      } satisfies TimelineStep<R>;
    })
    .sort((a, b) => a.order - b.order);
}

/** Group an ordered timeline into windows (only non-empty windows, in order). */
export function groupByWindow<R>(
  steps: TimelineStep<R>[],
): Array<{ window: LaunchWindow; label: string; steps: TimelineStep<R>[] }> {
  const byWindow = new Map<LaunchWindow, TimelineStep<R>[]>();
  for (const step of steps) {
    const list = byWindow.get(step.window) ?? [];
    list.push(step);
    byWindow.set(step.window, list);
  }
  return WINDOW_ORDER.filter((w) => byWindow.has(w)).map((w) => ({
    window: w,
    label: WINDOW_LABEL[w],
    steps: byWindow.get(w)!,
  }));
}
