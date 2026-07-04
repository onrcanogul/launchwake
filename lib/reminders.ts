/**
 * "Post at the best time" reminders — REMINDERS ONLY. LaunchWake never posts;
 * this produces a calendar event the founder can accept. Parsing is best-effort
 * over the catalog's human bestTime strings ("Tue–Thu 8am ET", "Mon/Wed 9am").
 */

export type WallTime = {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number; // 0-23
  minute: number;
};

const DAY_TOKENS: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

function parseDays(text: string): number[] {
  const s = text.toLowerCase();
  if (/\bweekday/.test(s)) return [1, 2, 3, 4, 5];
  if (/\bweekend/.test(s)) return [0, 6];
  if (/\bany|\bdaily|\bany day\b/.test(s)) return [0, 1, 2, 3, 4, 5, 6];

  const found: number[] = [];
  const re = /(sun|mon|tue|wed|thu|fri|sat)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) found.push(DAY_TOKENS[m[1]]);
  if (found.length === 0) return [];

  // A dash between two days means an inclusive range (Tue–Thu).
  if (found.length === 2 && /[–—-]/.test(s)) {
    const [a, b] = found;
    const out: number[] = [];
    for (let d = a; ; d = (d + 1) % 7) {
      out.push(d);
      if (d === b) break;
    }
    return out;
  }
  return [...new Set(found)];
}

function parseTime(text: string): { hour: number; minute: number } | null {
  const s = text.toLowerCase();
  const m = s.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/);
  if (m) {
    let hour = parseInt(m[1], 10);
    const minute = m[2] ? parseInt(m[2], 10) : 0;
    const mer = m[3];
    if (mer === "pm" && hour < 12) hour += 12;
    if (mer === "am" && hour === 12) hour = 0;
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return { hour, minute };
    }
  }
  if (/morning|\bam\b/.test(s)) return { hour: 9, minute: 0 };
  return null;
}

/**
 * Next occurrence of a bestTime string after `from` (UTC-based, returned as a
 * floating wall-clock so the user's calendar shows it in their own timezone).
 * Returns null when there's nothing schedulable (e.g. "invite only").
 */
export function nextBestTime(
  bestTime: string | null | undefined,
  from: Date,
): WallTime | null {
  if (!bestTime) return null;
  const days = parseDays(bestTime);
  if (days.length === 0) return null;
  const time = parseTime(bestTime) ?? { hour: 9, minute: 0 };

  const refDow = from.getUTCDay();
  for (let offset = 0; offset < 14; offset++) {
    const dow = (refDow + offset) % 7;
    if (!days.includes(dow)) continue;
    const cand = new Date(from.getTime());
    cand.setUTCDate(cand.getUTCDate() + offset);
    cand.setUTCHours(time.hour, time.minute, 0, 0);
    if (cand.getTime() > from.getTime()) {
      return {
        year: cand.getUTCFullYear(),
        month: cand.getUTCMonth() + 1,
        day: cand.getUTCDate(),
        hour: time.hour,
        minute: time.minute,
      };
    }
  }
  return null;
}

/**
 * Rough tz-abbreviation → UTC offset (hours). Summer/DST-ish; good enough to fire
 * a reminder near the intended local time. Defaults to ET.
 */
const TZ_OFFSETS: Record<string, number> = {
  ET: -4,
  ET_EDT: -4,
  EST: -5,
  EDT: -4,
  CT: -5,
  CST: -6,
  CDT: -5,
  MT: -6,
  MST: -7,
  MDT: -6,
  PT: -7,
  PST: -8,
  PDT: -7,
  GMT: 0,
  UTC: 0,
  BST: 1,
  CET: 1,
  CEST: 2,
};

function tzOffsetHours(bestTime: string): number {
  const m = bestTime.toUpperCase().match(/\b(E|P|C|M)(T|ST|DT)?\b|\b(GMT|UTC|BST|CET|CEST)\b/);
  if (!m) return TZ_OFFSETS.ET;
  const token = (m[0] || "ET").replace(/\s/g, "");
  return TZ_OFFSETS[token] ?? TZ_OFFSETS.ET;
}

/**
 * Absolute UTC instant of the next best-time slot — for actually firing an
 * email/Slack ping. Interprets the wall time in the string's timezone.
 * Returns null when there's nothing schedulable.
 */
export function nextBestTimeUTC(
  bestTime: string | null | undefined,
  from: Date,
): Date | null {
  if (!bestTime) return null;
  const offset = tzOffsetHours(bestTime);
  // Search wall-clock slots in the target tz until one is in the future (UTC).
  for (let probe = 0; probe < 3; probe++) {
    const wall = nextBestTime(bestTime, new Date(from.getTime() + probe * 60_000));
    if (!wall) return null;
    // wall is local-to-tz; convert to UTC by subtracting the offset.
    const utcMs = Date.UTC(
      wall.year,
      wall.month - 1,
      wall.day,
      wall.hour - offset,
      wall.minute,
    );
    if (utcMs > from.getTime()) return new Date(utcMs);
    from = new Date(utcMs + 60_000); // advance past this slot and retry
  }
  return null;
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function fmt(w: WallTime): string {
  return `${w.year}${pad(w.month)}${pad(w.day)}T${pad(w.hour)}${pad(w.minute)}00`;
}

function addMinutes(w: WallTime, mins: number): WallTime {
  const d = new Date(Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute));
  d.setUTCMinutes(d.getUTCMinutes() + mins);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
  };
}

function escapeICS(text: string): string {
  return text.replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
}

export type ICSInput = {
  uid: string;
  title: string;
  description: string;
  start: WallTime;
  durationMinutes?: number;
  /** stamp; pass a fixed value in tests for determinism */
  stamp?: string;
};

export type ReminderLike = {
  shipId: string;
  channelName: string;
  shipTitle: string;
  bestTimeLabel?: string | null;
  ruleNote?: string | null;
};

/** Email/Slack copy for a due reminder (pure). Reminder only — never posts. */
export function reminderMessage(
  r: ReminderLike,
  appUrl: string,
): { subject: string; text: string } {
  const url = `${appUrl.replace(/\/$/, "")}/app/ships/${r.shipId}/kit`;
  const subject = `Time to post "${r.shipTitle}" to ${r.channelName}`;
  const text = [
    `It's a good time to post to ${r.channelName}${
      r.bestTimeLabel ? ` (${r.bestTimeLabel})` : ""
    }.`,
    r.ruleNote ? `Safe way in: ${r.ruleNote}` : "",
    `Your draft is ready: ${url}`,
    "",
    "— LaunchWake · reminder only, you post it yourself.",
  ]
    .filter((l) => l !== "")
    .join("\n");
  return { subject, text };
}

/** One floating-time VEVENT (with a 30-min display alarm). */
function vevent(input: ICSInput): string[] {
  const end = addMinutes(input.start, input.durationMinutes ?? 30);
  return [
    "BEGIN:VEVENT",
    `UID:${input.uid}`,
    `DTSTAMP:${input.stamp ?? fmt(input.start) + "Z"}`,
    `DTSTART:${fmt(input.start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${escapeICS(input.title)}`,
    `DESCRIPTION:${escapeICS(input.description)}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT30M",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeICS(input.title)}`,
    "END:VALARM",
    "END:VEVENT",
  ];
}

const VCALENDAR_HEAD = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "PRODID:-//LaunchWake//Reminders//EN",
  "CALSCALE:GREGORIAN",
  "METHOD:PUBLISH",
];

/** Build a minimal, valid VCALENDAR with one floating-time VEVENT. */
export function buildICS(input: ICSInput): string {
  return [...VCALENDAR_HEAD, ...vevent(input), "END:VCALENDAR"].join("\r\n");
}

/** Build a VCALENDAR with several events — the whole launch schedule at once. */
export function buildICSCalendar(events: ICSInput[]): string {
  return [...VCALENDAR_HEAD, ...events.flatMap(vevent), "END:VCALENDAR"].join(
    "\r\n",
  );
}
