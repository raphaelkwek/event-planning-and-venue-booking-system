import { describe, expect, it } from "vitest";
import {
  assembleCalendar,
  calendarDays,
  MAX_CALENDAR_DAYS,
  readCalendarRange,
  type CalendarRow,
} from "../../../src/modules/venue/domain/availabilityCalendar.js";

/**
 * I1 — the calendar's pure rules: which dates a request covers, each date's
 * opening hours, and how Postgres's periods become a day's committed and free
 * lists. Postgres decides what overlaps what (repo/availability.ts); nothing
 * here compares two periods.
 */

describe("readCalendarRange", () => {
  it("accepts a week and lists each date in it", () => {
    const result = readCalendarRange("2026-12-07", "2026-12-13");
    expect(result).toEqual({
      ok: true,
      range: {
        from: "2026-12-07",
        to: "2026-12-13",
        dates: ["2026-12-07", "2026-12-08", "2026-12-09", "2026-12-10", "2026-12-11", "2026-12-12", "2026-12-13"],
      },
    });
  });

  it("accepts a single day (I1-T12)", () => {
    expect(readCalendarRange("2026-12-10", "2026-12-10")).toEqual({
      ok: true,
      range: { from: "2026-12-10", to: "2026-12-10", dates: ["2026-12-10"] },
    });
  });

  it(`accepts exactly ${MAX_CALENDAR_DAYS} days, across a month end (I1-T13)`, () => {
    const result = readCalendarRange("2026-12-01", "2026-12-31");
    expect(result.ok && result.range.dates).toHaveLength(31);
    const crossing = readCalendarRange("2027-01-20", "2027-02-19");
    expect(crossing.ok && crossing.range.dates.at(-1)).toBe("2027-02-19");
  });

  it("refuses 32 days, naming the limit and the length asked for (I1-T13)", () => {
    expect(readCalendarRange("2026-12-01", "2027-01-01")).toEqual({
      ok: false,
      fields: [{ field: "to", message: "A range can be at most 31 days; this one is 32." }],
    });
  });

  it("refuses an end before the start (I1-T13)", () => {
    expect(readCalendarRange("2026-12-13", "2026-12-07")).toEqual({
      ok: false,
      fields: [{ field: "to", message: "The end date must not be before the start date." }],
    });
  });

  it("names every date that is missing, malformed or impossible", () => {
    expect(readCalendarRange(undefined, "13/12/2026")).toEqual({
      ok: false,
      fields: [
        { field: "from", message: "Enter the start date as YYYY-MM-DD, for example 2026-12-07." },
        { field: "to", message: "Enter the end date as YYYY-MM-DD, for example 2026-12-13." },
      ],
    });
    expect(readCalendarRange("2026-02-30", ["2026-03-01"])).toEqual({
      ok: false,
      fields: [
        { field: "from", message: "Enter the start date as YYYY-MM-DD, for example 2026-12-07." },
        { field: "to", message: "Enter the end date as YYYY-MM-DD, for example 2026-12-13." },
      ],
    });
  });
});

describe("calendarDays", () => {
  const weekdays = { opensAt: "08:00", closesAt: "22:00" };
  const hours = {
    monday: weekdays,
    tuesday: weekdays,
    wednesday: weekdays,
    thursday: weekdays,
    friday: weekdays,
    saturday: { opensAt: "09:00", closesAt: "18:00" },
    sunday: null,
  };

  it("gives each date its weekday's hours, and none on a closed day (I1-T6)", () => {
    expect(calendarDays(["2026-12-11", "2026-12-12", "2026-12-13"], hours)).toEqual([
      { date: "2026-12-11", opensAt: "08:00", closesAt: "22:00" },
      { date: "2026-12-12", opensAt: "09:00", closesAt: "18:00" },
      { date: "2026-12-13", opensAt: null, closesAt: null },
    ]);
  });

  it("treats a weekday with no recorded hours as closed", () => {
    expect(calendarDays(["2026-12-07"], {})).toEqual([{ date: "2026-12-07", opensAt: null, closesAt: null }]);
  });
});

describe("assembleCalendar", () => {
  const at = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00+08:00`);
  const MON = "2026-12-07";
  const symposium = "e0000000-0000-0000-0000-000000000001";
  const alumni = "e0000000-0000-0000-0000-000000000002";
  const references = new Map([
    [symposium, "EVT-000101"],
    [alumni, "EVT-000102"],
  ]);

  function row(kind: CalendarRow["kind"], from: string, until: string, extra: Partial<CalendarRow> = {}): CalendarRow {
    return {
      date: MON,
      kind,
      startsAt: at(MON, from),
      endsAt: until === "24:00" ? at("2026-12-08", "00:00") : at(MON, until),
      slotStatus: null,
      eventId: null,
      reasonType: null,
      description: null,
      ...extra,
    };
  }

  it("lists a booking with its setup and turnaround, labelled with the event reference (I1-T2, I1-T5)", () => {
    const booking = { slotStatus: "CONFIRMED" as const, eventId: symposium };
    const [day] = assembleCalendar(
      [MON],
      [
        row("TURNAROUND", "12:00", "12:30", booking),
        row("BOOKING", "10:00", "12:00", booking),
        row("SETUP", "09:30", "10:00", booking),
      ],
      references,
    );

    expect(day!.committed).toEqual([
      { kind: "SETUP", startsAt: "2026-12-07T01:30:00.000Z", endsAt: "2026-12-07T02:00:00.000Z", bookingStatus: "CONFIRMED", eventReference: "EVT-000101" },
      { kind: "BOOKING", startsAt: "2026-12-07T02:00:00.000Z", endsAt: "2026-12-07T04:00:00.000Z", bookingStatus: "CONFIRMED", eventReference: "EVT-000101" },
      { kind: "TURNAROUND", startsAt: "2026-12-07T04:00:00.000Z", endsAt: "2026-12-07T04:30:00.000Z", bookingStatus: "CONFIRMED", eventReference: "EVT-000101" },
    ]);
  });

  it("shows a held slot as pending (I1-T3)", () => {
    const [day] = assembleCalendar([MON], [row("BOOKING", "14:00", "16:00", { slotStatus: "HELD", eventId: alumni })], references);
    expect(day!.committed[0]).toMatchObject({ kind: "BOOKING", bookingStatus: "PENDING", eventReference: "EVT-000102" });
  });

  it("leaves the reference empty when the event can no longer be found", () => {
    const [day] = assembleCalendar(
      [MON],
      [row("BOOKING", "14:00", "16:00", { slotStatus: "CONFIRMED", eventId: "e0000000-0000-0000-0000-0000000000ff" })],
      references,
    );
    expect(day!.committed[0]).toMatchObject({ eventReference: null });
  });

  it("gives a block its type and reason, and an outside-hours period neither (I1-T4, I1-T6)", () => {
    const [day] = assembleCalendar(
      [MON],
      [
        row("UNAVAILABLE", "09:00", "13:00", { reasonType: "MAINTENANCE", description: "Stage lighting rewiring" }),
        row("OUTSIDE_HOURS", "00:00", "08:00"),
      ],
      references,
    );
    expect(day!.committed).toEqual([
      { kind: "OUTSIDE_HOURS", startsAt: "2026-12-06T16:00:00.000Z", endsAt: "2026-12-07T00:00:00.000Z" },
      {
        kind: "UNAVAILABLE",
        startsAt: "2026-12-07T01:00:00.000Z",
        endsAt: "2026-12-07T05:00:00.000Z",
        reasonType: "MAINTENANCE",
        description: "Stage lighting rewiring",
      },
    ]);
  });

  it("orders periods that start together: outside hours, then setup, the event, turnaround and blocks", () => {
    const booking = { slotStatus: "CONFIRMED" as const, eventId: symposium };
    const [day] = assembleCalendar(
      [MON],
      [
        row("UNAVAILABLE", "00:00", "12:00", { reasonType: "RENOVATION", description: "Seat replacement" }),
        row("BOOKING", "00:00", "01:00", booking),
        row("OUTSIDE_HOURS", "00:00", "08:00"),
        row("TURNAROUND", "00:00", "00:30", booking),
        row("SETUP", "00:00", "00:15", booking),
      ],
      references,
    );
    expect(day!.committed.map((period) => period.kind)).toEqual(["OUTSIDE_HOURS", "SETUP", "BOOKING", "TURNAROUND", "UNAVAILABLE"]);
  });

  it("puts free periods in their own list, in order, and gives every date a day even with nothing on it (I1-T1)", () => {
    const days = assembleCalendar(
      [MON, "2026-12-13"],
      [row("FREE", "16:45", "22:00"), row("FREE", "08:00", "09:30"), row("OUTSIDE_HOURS", "00:00", "24:00", { date: "2026-12-13" })],
      references,
    );
    expect(days.map((day) => day.date)).toEqual([MON, "2026-12-13"]);
    expect(days[0]!.free).toEqual([
      { startsAt: "2026-12-07T00:00:00.000Z", endsAt: "2026-12-07T01:30:00.000Z" },
      { startsAt: "2026-12-07T08:45:00.000Z", endsAt: "2026-12-07T14:00:00.000Z" },
    ]);
    expect(days[0]!.committed).toEqual([]);
    expect(days[1]!.free).toEqual([]);
    expect(days[1]!.committed).toHaveLength(1);
  });
});
