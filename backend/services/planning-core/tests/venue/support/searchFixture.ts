import { randomUUID } from "node:crypto";
import type { Sql } from "postgres";

/**
 * The venues, bookings, hold and blocks the J1/J2 tests search, the same as
 * FX-SEARCH in tests/J1/README.md (with a "J1T" prefix instead of "FX"), so a
 * failing test and a failing card describe the same thing. Test-only.
 *
 * Every venue is created by STAFF and every slot by COORDINATOR, so a test
 * removes exactly its own rows. The shared database holds other venues too:
 * tests narrow a search to these with the building "J1T".
 */

export const STAFF = "a9999999-0000-0000-0000-000000000031";
export const COORDINATOR = "a9999999-0000-0000-0000-000000000032";
export const OWNER = "a9999999-0000-0000-0000-000000000033";

const open = (opensAt: string, closesAt: string) => ({ opensAt, closesAt });
export const WEEKDAYS = {
  monday: open("08:00", "22:00"),
  tuesday: open("08:00", "22:00"),
  wednesday: open("08:00", "22:00"),
  thursday: open("08:00", "22:00"),
  friday: open("08:00", "22:00"),
  saturday: open("09:00", "18:00"),
  sunday: null,
};
const LATE = {
  monday: open("12:00", "20:00"),
  tuesday: open("12:00", "20:00"),
  wednesday: open("12:00", "20:00"),
  thursday: open("12:00", "20:00"),
  friday: open("12:00", "20:00"),
  saturday: null,
  sunday: null,
};

/** A Singapore time on a December 2026 day. */
export const at = (day: number, hhmm: string) => `2026-12-${String(day).padStart(2, "0")}T${hhmm}:00+08:00`;

interface FixtureVenue {
  name: string;
  building: string;
  maxCapacity: number;
  layouts: { name: string; capacity: number }[];
  facilities: string[];
  accessibilityFeatures: string[];
  hours: object;
  status: "ACTIVE" | "INACTIVE";
}

const VENUES: FixtureVenue[] = [
  {
    name: "J1T Auditorium",
    building: "J1T Science Block",
    maxCapacity: 300,
    layouts: [{ name: "Theatre", capacity: 300 }, { name: "Classroom", capacity: 120 }],
    facilities: ["Projector", "Wireless microphones"],
    accessibilityFeatures: ["Step-free access", "Hearing loop"],
    hours: WEEKDAYS,
    status: "ACTIVE",
  },
  {
    name: "J1T Seminar Room",
    building: "J1T Science Block",
    maxCapacity: 60,
    layouts: [{ name: "Classroom", capacity: 40 }, { name: "Boardroom", capacity: 20 }],
    facilities: ["Projector"],
    accessibilityFeatures: ["Step-free access"],
    hours: WEEKDAYS,
    status: "ACTIVE",
  },
  {
    name: "J1T Lecture Hall",
    building: "J1T Arts Building",
    maxCapacity: 200,
    layouts: [{ name: "Theatre", capacity: 200 }, { name: "Classroom", capacity: 80 }],
    facilities: ["Projector", "Wireless microphones", "Stage lighting"],
    accessibilityFeatures: ["Step-free access", "Hearing loop", "Accessible toilet"],
    hours: WEEKDAYS,
    status: "ACTIVE",
  },
  {
    name: "J1T Old Gym",
    building: "J1T Arts Building",
    maxCapacity: 500,
    layouts: [{ name: "Theatre", capacity: 500 }],
    facilities: ["Projector", "Wireless microphones", "Stage lighting"],
    accessibilityFeatures: ["Step-free access", "Hearing loop", "Accessible toilet"],
    hours: WEEKDAYS,
    status: "INACTIVE",
  },
  {
    name: "J1T Late Studio",
    building: "J1T Media Centre",
    maxCapacity: 100,
    layouts: [{ name: "Theatre", capacity: 100 }],
    facilities: ["Projector"],
    accessibilityFeatures: ["Step-free access"],
    hours: LATE,
    status: "ACTIVE",
  },
];

type Slot = [venue: string, reference: string, from: string, until: string, setup: number, turnaround: number, status: string];
const SLOTS: Slot[] = [
  ["J1T Auditorium", "J1-FX-CONFIRMED", at(14, "10:00"), at(14, "12:00"), 0, 0, "CONFIRMED"],
  ["J1T Seminar Room", "J1-FX-HELD", at(14, "14:00"), at(14, "16:00"), 0, 0, "HELD"],
  ["J1T Auditorium", "J1-FX-OCCUPIED", at(15, "14:00"), at(15, "16:00"), 30, 30, "CONFIRMED"],
  ["J1T Lecture Hall", "J1-FX-RELEASED", at(14, "15:00"), at(14, "17:00"), 0, 0, "RELEASED"],
];
type Block = [venue: string, from: string, until: string, reason: string, status: string];
const BLOCKS: Block[] = [
  ["J1T Lecture Hall", at(14, "09:00"), at(14, "13:00"), "MAINTENANCE", "ACTIVE"],
  ["J1T Lecture Hall", at(16, "09:00"), at(16, "13:00"), "RENOVATION", "REMOVED"],
];

/** Writes the five venues with their slots and blocks; returns each venue's id by name. */
export async function seedSearchFixture(sql: Sql): Promise<Record<string, string>> {
  const ids: Record<string, string> = {};
  for (const v of VENUES) {
    const [row] = await sql<{ id: string }[]>`
      insert into venue.venues
        (name, building, max_capacity, layouts, facilities, accessibility_features, operating_hours, status, created_by, updated_by)
      values (${v.name}, ${v.building}, ${v.maxCapacity}, ${sql.json(v.layouts)}, ${v.facilities}, ${v.accessibilityFeatures},
              ${sql.json(v.hours as never)}, ${v.status}, ${STAFF}, ${STAFF})
      returning id
    `;
    ids[v.name] = row!.id;
  }
  for (const [venue, reference, from, until, setup, turnaround, status] of SLOTS) {
    await sql`
      insert into venue.venue_slots
        (venue_id, event_id, reference, starts_at, ends_at, setup_minutes, turnaround_minutes, status, created_by, updated_by)
      values (${ids[venue]!}, ${randomUUID()}, ${reference}, ${from}, ${until}, ${setup}, ${turnaround}, ${status}, ${COORDINATOR}, ${COORDINATOR})
    `;
  }
  for (const [venue, from, until, reason, status] of BLOCKS) {
    await sql`
      insert into venue.unavailability_blocks (venue_id, starts_at, ends_at, reason_type, description, status, created_by, updated_by)
      values (${ids[venue]!}, ${from}, ${until}, ${reason}, 'J1 fixture', ${status}, ${STAFF}, ${STAFF})
    `;
  }
  return ids;
}

/** Test-only: removes the fixture's rows (the application never deletes; implementation.md §4.3). */
export async function removeSearchFixture(sql: Sql): Promise<void> {
  const ours = sql`select id from venue.venues where created_by = ${STAFF}`;
  await sql`delete from venue.venue_slots where venue_id in (${ours})`;
  await sql`delete from venue.unavailability_blocks where venue_id in (${ours})`;
  await sql`delete from venue.venues where created_by = ${STAFF}`;
}
