import type { Sql, TransactionSql } from "postgres";
import { CALENDAR_TIME_ZONE } from "../domain/availabilityCalendar.js";
import { containsPattern, type SearchFilters } from "../domain/venueSearch.js";
import type { CatalogueOptions } from "../domain/searchPrefill.js";

/**
 * J1, J2 — which active venues meet a search. SQL against the venue schema only.
 *
 * Postgres does every comparison (implementation.md §4.4): `&&` on a slot's
 * stored `blocked_period` (its own period plus its setup and turnaround, EN-02.1)
 * and on a block's `period` finds what overlaps the requested window, `<@`
 * checks the window lies inside the venue's opening hours, and `@>` checks the
 * required facilities are all present. Periods that merely touch do not overlap
 * because every range is half-open. Held and confirmed slots and active blocks
 * count; released and expired slots and removed blocks do not.
 */

type Db = Sql | TransactionSql;

export interface VenueSearchItem {
  id: string;
  name: string;
  building: string;
  maxCapacity: number;
  /** The chosen layout's capacity when a layout filter is set; null otherwise. */
  layoutCapacity: number | null;
  facilities: string[];
  accessibilityFeatures: string[];
}

interface SearchRow {
  id: string;
  name: string;
  building: string;
  max_capacity: number;
  layout_capacity: number | null;
  facilities: string[];
  accessibility_features: string[];
}

/**
 * CR-01: the requested window is widened by the venue's own setup time before
 * it and turnaround time after it. Those two columns belong to H3 and are not
 * on main yet, so both are 0 minutes for now. When H3 lands, change the two
 * fragments to `db\`v.setup_minutes\`` and `db\`v.turnaround_minutes\``; nothing
 * else needs to change.
 */
const venueSetupMinutes = (db: Db) => db`0`;
const venueTurnaroundMinutes = (db: Db) => db`0`;

/** The window, widened, as a range of the venue `v` the query is looking at. */
function widenedWindow(db: Db, from: string, to: string) {
  return db`tstzrange(
    ${from}::timestamptz - make_interval(mins => ${venueSetupMinutes(db)}),
    ${to}::timestamptz + make_interval(mins => ${venueTurnaroundMinutes(db)}),
    '[)')`;
}

/** Nothing else is on at the venue: no slot or block overlaps the widened window. */
function isFreeDuring(db: Db, from: string, to: string) {
  return db`
    and not exists (
      select 1 from venue.venue_slots s
      where s.venue_id = v.id and s.status in ('HELD', 'CONFIRMED')
        and s.blocked_period && ${widenedWindow(db, from, to)})
    and not exists (
      select 1 from venue.unavailability_blocks b
      where b.venue_id = v.id and b.status = 'ACTIVE'
        and b.period && ${widenedWindow(db, from, to)})`;
}

/**
 * The venue is open for the whole window. Each calendar day the window touches
 * contributes that weekday's opening hours (a weekday with none is closed), and
 * the window must lie inside them, so a window that crosses a closed night, or
 * a day with no hours, fails.
 */
function isOpenDuring(db: Db, from: string, to: string) {
  return db`
    and tstzrange(${from}::timestamptz, ${to}::timestamptz, '[)') <@ (
      select range_agg(tstzrange(
               (open_day.d + (open_day.hours ->> 'opensAt')::time) at time zone ${CALENDAR_TIME_ZONE}::text,
               (open_day.d + (open_day.hours ->> 'closesAt')::time) at time zone ${CALENDAR_TIME_ZONE}::text))
      from (
        select g::date as d, v.operating_hours -> lower(btrim(to_char(g, 'day'))) as hours
        from generate_series(
               (${from}::timestamptz at time zone ${CALENDAR_TIME_ZONE}::text)::date::timestamp,
               ((${to}::timestamptz - interval '1 microsecond') at time zone ${CALENDAR_TIME_ZONE}::text)::date::timestamp,
               interval '1 day') as g
      ) as open_day
      where jsonb_typeof(open_day.hours) = 'object')`;
}

/** Every listed name is present, ignoring case. */
function hasAll(db: Db, column: "facilities" | "accessibility_features", names: readonly string[]) {
  const required = names.map((name) => name.toLowerCase());
  const offered = column === "facilities" ? db`v.facilities` : db`v.accessibility_features`;
  return db`and array(select lower(entry) from unnest(${offered}) as entry) @> ${required}::text[]`;
}

export async function searchVenues(db: Db, filters: SearchFilters): Promise<VenueSearchItem[]> {
  const { q, from, to, minCapacity, location, layout, facilities, accessibility } = filters;
  const pattern = q === null ? null : containsPattern(q);

  const rows = await db<SearchRow[]>`
    select v.id, v.name, v.building, v.max_capacity, v.facilities, v.accessibility_features,
           ${layout ? db`lay.capacity` : db`null::int`} as layout_capacity
    from venue.venues v
    ${
      layout
        ? db`cross join lateral (
              select (entry.layout ->> 'capacity')::int as capacity
              from jsonb_array_elements(v.layouts) as entry(layout)
              where lower(entry.layout ->> 'name') = lower(${layout}::text)
              limit 1) as lay`
        : db``
    }
    where v.status = 'ACTIVE'
    ${pattern === null ? db`` : db`and (v.name ilike ${pattern} or v.building ilike ${pattern})`}
    ${location === null ? db`` : db`and v.building ilike ${containsPattern(location)}`}
    ${minCapacity === null ? db`` : db`and ${layout ? db`lay.capacity` : db`v.max_capacity`} >= ${minCapacity}`}
    ${facilities.length === 0 ? db`` : hasAll(db, "facilities", facilities)}
    ${accessibility.length === 0 ? db`` : hasAll(db, "accessibility_features", accessibility)}
    ${from === null || to === null ? db`` : db`${isOpenDuring(db, from, to)} ${isFreeDuring(db, from, to)}`}
    order by lower(v.name), v.id
  `;

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    building: row.building,
    maxCapacity: row.max_capacity,
    layoutCapacity: row.layout_capacity,
    facilities: row.facilities,
    accessibilityFeatures: row.accessibility_features,
  }));
}

/** The layouts, facilities and accessibility features the active venues offer, one spelling each. */
export async function listCatalogueOptions(db: Db): Promise<CatalogueOptions> {
  const layouts = await db<{ name: string }[]>`
    select distinct on (lower(entry.layout ->> 'name')) entry.layout ->> 'name' as name
    from venue.venues v, jsonb_array_elements(v.layouts) as entry(layout)
    where v.status = 'ACTIVE'
    order by lower(entry.layout ->> 'name'), 1`;
  const facilities = await db<{ name: string }[]>`
    select distinct on (lower(entry)) entry as name
    from venue.venues v, unnest(v.facilities) as entry
    where v.status = 'ACTIVE'
    order by lower(entry), 1`;
  const accessibilityFeatures = await db<{ name: string }[]>`
    select distinct on (lower(entry)) entry as name
    from venue.venues v, unnest(v.accessibility_features) as entry
    where v.status = 'ACTIVE'
    order by lower(entry), 1`;
  return {
    layouts: layouts.map((row) => row.name),
    facilities: facilities.map((row) => row.name),
    accessibilityFeatures: accessibilityFeatures.map((row) => row.name),
  };
}
