import type { ErrorField, UnavailabilityReasonType } from "@connectsphere/contracts";

/**
 * I1 — a venue's availability calendar. These rules decide which dates a
 * request covers and each date's opening hours, and arrange what Postgres
 * returns into a day's committed and free lists. Postgres decides what overlaps
 * what, with && and range arithmetic (repo/availability.ts, implementation.md
 * §4.4); nothing here compares two periods.
 */

/** The venues are in Singapore, so a calendar day runs midnight to midnight there. */
export const CALENDAR_TIME_ZONE = "Asia/Singapore";
export const MAX_CALENDAR_DAYS = 31;

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;

export interface CalendarRange {
  from: string;
  to: string;
  dates: string[];
}

/**
 * Milliseconds at UTC midnight for a real YYYY-MM-DD date; null for anything
 * else. Writing the parsed date back out and comparing it with the input is the
 * whole check: it refuses every other shape, 2026-02-30 included.
 */
function parseDate(value: unknown): number | null {
  const time = Date.parse(`${value}T00:00:00Z`);
  if (Number.isNaN(time)) return null;
  return new Date(time).toISOString().slice(0, 10) === value ? time : null;
}

/** The query's from and to dates, both included, or every field that is wrong with them. */
export function readCalendarRange(
  from: unknown,
  to: unknown,
): { ok: true; range: CalendarRange } | { ok: false; fields: ErrorField[] } {
  const start = parseDate(from);
  const end = parseDate(to);
  const fields: ErrorField[] = [];
  if (start === null) fields.push({ field: "from", message: "Enter the start date as YYYY-MM-DD, for example 2026-12-07." });
  if (end === null) fields.push({ field: "to", message: "Enter the end date as YYYY-MM-DD, for example 2026-12-13." });
  if (start === null || end === null) return { ok: false, fields };

  if (end < start) {
    return { ok: false, fields: [{ field: "to", message: "The end date must not be before the start date." }] };
  }
  const length = (end - start) / DAY_MS + 1;
  if (length > MAX_CALENDAR_DAYS) {
    return {
      ok: false,
      fields: [{ field: "to", message: `A range can be at most ${MAX_CALENDAR_DAYS} days; this one is ${length}.` }],
    };
  }
  const dates = Array.from({ length }, (_, i) => new Date(start + i * DAY_MS).toISOString().slice(0, 10));
  return { ok: true, range: { from: from as string, to: to as string, dates } };
}

export interface CalendarDay {
  date: string;
  /** HH:MM in the calendar's time zone; both null when the venue is closed that day. */
  opensAt: string | null;
  closesAt: string | null;
}

type OperatingHours = Partial<Record<(typeof WEEKDAYS)[number], { opensAt: string; closesAt: string } | null>>;

/** Each date with its weekday's operating hours (H1). A weekday with none recorded is closed. */
export function calendarDays(dates: readonly string[], operatingHours: OperatingHours): CalendarDay[] {
  return dates.map((date) => {
    const hours = operatingHours[WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()]!] ?? null;
    return { date, opensAt: hours?.opensAt ?? null, closesAt: hours?.closesAt ?? null };
  });
}

export type CommittedKind = "OUTSIDE_HOURS" | "SETUP" | "BOOKING" | "TURNAROUND" | "UNAVAILABLE";

/** One period of one day, as the repo reads it. */
export interface CalendarRow {
  date: string;
  kind: CommittedKind | "FREE";
  startsAt: Date;
  endsAt: Date;
  slotStatus: "HELD" | "CONFIRMED" | null;
  eventId: string | null;
  reasonType: UnavailabilityReasonType | null;
  description: string | null;
}

export interface CommittedPeriod {
  kind: CommittedKind;
  startsAt: string;
  endsAt: string;
  /** Bookings, and their setup and turnaround. A held slot is a pending request (§4.6 rule 3). */
  bookingStatus?: "CONFIRMED" | "PENDING";
  eventReference?: string | null;
  /** Unavailability blocks (I2). */
  reasonType?: UnavailabilityReasonType;
  description?: string;
}

export interface CalendarDayView {
  date: string;
  committed: CommittedPeriod[];
  free: { startsAt: string; endsAt: string }[];
}

/** Among periods starting at the same moment, the order a reader expects. */
const KIND_ORDER: Record<CalendarRow["kind"], number> = {
  OUTSIDE_HOURS: 0,
  SETUP: 1,
  BOOKING: 2,
  TURNAROUND: 3,
  UNAVAILABLE: 4,
  FREE: 5,
};

function committedPeriod(row: CalendarRow, references: ReadonlyMap<string, string | null>): CommittedPeriod {
  const period = { kind: row.kind as CommittedKind, startsAt: row.startsAt.toISOString(), endsAt: row.endsAt.toISOString() };
  if (row.slotStatus) {
    return {
      ...period,
      bookingStatus: row.slotStatus === "HELD" ? "PENDING" : "CONFIRMED",
      eventReference: references.get(row.eventId!) ?? null,
    };
  }
  if (row.reasonType) return { ...period, reasonType: row.reasonType, description: row.description! };
  return period;
}

/** One entry per date, in order, each with its committed and free periods in time order. */
export function assembleCalendar(
  dates: readonly string[],
  rows: readonly CalendarRow[],
  references: ReadonlyMap<string, string | null>,
): CalendarDayView[] {
  const sorted = [...rows].sort(
    (a, b) => a.startsAt.getTime() - b.startsAt.getTime() || KIND_ORDER[a.kind] - KIND_ORDER[b.kind],
  );
  return dates.map((date) => {
    const today = sorted.filter((row) => row.date === date);
    return {
      date,
      committed: today.filter((row) => row.kind !== "FREE").map((row) => committedPeriod(row, references)),
      free: today
        .filter((row) => row.kind === "FREE")
        .map((row) => ({ startsAt: row.startsAt.toISOString(), endsAt: row.endsAt.toISOString() })),
    };
  });
}
