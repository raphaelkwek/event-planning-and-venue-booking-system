import type { Sql } from "postgres";
import { CALENDAR_TIME_ZONE, type CalendarDay, type CalendarRow } from "../domain/availabilityCalendar.js";

/**
 * I1 — what commits a venue on each day of a range, and what is left free.
 * SQL against the venue schema only.
 *
 * Postgres does every comparison (implementation.md §4.4): `&&` finds the
 * holds, bookings and blocks touching a day, `*` clips each to the day, and
 * multirange subtraction leaves the free periods. A slot's occupied period is
 * its stored `blocked_period` (EN-02.1), so setup and turnaround are the parts
 * of it before `starts_at` and after `ends_at`. A held slot is shown pending;
 * released and expired slots and removed blocks commit nothing.
 *
 * Free time is opening hours minus every slot and block. A booking or block
 * outside opening hours is still listed, beside the outside-hours period.
 */

interface Row {
  date: string;
  kind: CalendarRow["kind"];
  slot_status: CalendarRow["slotStatus"];
  event_id: string | null;
  reason_type: CalendarRow["reasonType"];
  description: string | null;
  starts_at: Date;
  ends_at: Date;
}

export async function readAvailability(sql: Sql, venueId: string, days: readonly CalendarDay[]): Promise<CalendarRow[]> {
  const rows = await sql<Row[]>`
    with day as (
      select d.date,
             tstzrange(d.date::timestamp at time zone ${CALENDAR_TIME_ZONE},
                       (d.date + 1)::timestamp at time zone ${CALENDAR_TIME_ZONE}) as span,
             case when d."opensAt" is null then 'empty'::tstzrange
                  else tstzrange((d.date + d."opensAt") at time zone ${CALENDAR_TIME_ZONE},
                                 (d.date + d."closesAt") at time zone ${CALENDAR_TIME_ZONE}) end as open
      from jsonb_to_recordset(${sql.json(days as never)}::jsonb) as d(date date, "opensAt" time, "closesAt" time)
    ),
    slot as (
      select day.date, day.span, s.status, s.event_id, s.starts_at, s.ends_at, s.period, s.blocked_period
      from day
      join venue.venue_slots s
        on s.venue_id = ${venueId} and s.status in ('HELD', 'CONFIRMED') and s.blocked_period && day.span
    ),
    committed as (
      select date, 'SETUP'::text as kind, status as slot_status, event_id, null::text as reason_type,
             null::text as description, tstzrange(lower(blocked_period), starts_at) * span as part
      from slot
      union all
      select date, 'BOOKING', status, event_id, null, null, period * span from slot
      union all
      select date, 'TURNAROUND', status, event_id, null, null, tstzrange(ends_at, upper(blocked_period)) * span from slot
      union all
      select day.date, 'UNAVAILABLE', null, null, b.reason_type, b.description, b.period * day.span
      from day
      join venue.unavailability_blocks b
        on b.venue_id = ${venueId} and b.status = 'ACTIVE' and b.period && day.span
      union all
      select date, 'OUTSIDE_HOURS', null, null, null, null, unnest(tstzmultirange(span) - tstzmultirange(open)) from day
    ),
    free as (
      select day.date, 'FREE'::text as kind, null::text as slot_status, null::uuid as event_id, null::text as reason_type,
             null::text as description,
             unnest(tstzmultirange(day.open) - coalesce(
               (select range_agg(c.part) from committed c where c.date = day.date and c.kind <> 'OUTSIDE_HOURS'),
               '{}'::tstzmultirange)) as part
      from day
    )
    select to_char(date, 'YYYY-MM-DD') as date, kind, slot_status, event_id, reason_type, description,
           lower(part) as starts_at, upper(part) as ends_at
    from (select * from committed union all select * from free) as period
    where not isempty(part)
    order by date, lower(part)
  `;
  return rows.map((row) => ({
    date: row.date,
    kind: row.kind,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    slotStatus: row.slot_status,
    eventId: row.event_id,
    reasonType: row.reason_type,
    description: row.description,
  }));
}
