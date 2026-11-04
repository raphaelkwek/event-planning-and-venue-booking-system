import { must } from "./api.js";
import { uniqueName } from "./names.js";
import { approvedRequest, createVenue, type EventRow, type VenueRow } from "./seed.js";
import { approveBooking, makeInactive, requestBooking, type BookingRequestRow, type HoldRow } from "./seed-venues.js";

/**
 * Seeding for the venue-search and suitability journeys (J1, J2, K1, M1, L4): the cards' FX-SEARCH
 * and FX-SUITABILITY venues and the bookings, holds and blocks they carry, made through the API as
 * the user who would make them. Every venue's name and building end in a suffix no other run has
 * used, so a journey judges only its own rows (the cards' "judge only the rows whose name starts
 * with FX", with the shared database the cards assume replaced by the job's own).
 */

/**
 * The cards' December 2026 days, moved into March 2027 on the same weekdays (EN-14's date shift,
 * documentation/evidence/EN-14/README.md): Sunday 13 Dec becomes 7 March, Monday 14 Dec 8 March,
 * Tuesday 15 Dec 9 March and Wednesday 16 Dec 10 March.
 */
export const DAYS = { sunday: "2027-03-07", monday: "2027-03-08", tuesday: "2027-03-09", wednesday: "2027-03-10" } as const;

/** A Singapore wall-clock time on a day, as the UTC instant the API takes. */
export function sgt(day: string, time: string): string {
  return new Date(`${day}T${time}:00+08:00`).toISOString();
}

/** The text a datetime-local field takes for a Singapore wall-clock time. */
export const localInput = (day: string, time: string) => `${day}T${time}`;

const WEEKDAY = { opensAt: "08:00", closesAt: "22:00" };
const STANDARD_HOURS = {
  monday: WEEKDAY,
  tuesday: WEEKDAY,
  wednesday: WEEKDAY,
  thursday: WEEKDAY,
  friday: WEEKDAY,
  saturday: { opensAt: "09:00", closesAt: "18:00" },
  sunday: null,
};
const LATE_WEEKDAY = { opensAt: "12:00", closesAt: "20:00" };
const LATE_HOURS = {
  monday: LATE_WEEKDAY,
  tuesday: LATE_WEEKDAY,
  wednesday: LATE_WEEKDAY,
  thursday: LATE_WEEKDAY,
  friday: LATE_WEEKDAY,
  saturday: null,
  sunday: null,
};

export interface FxVenues {
  /** The text every name and building of this run ends with. */
  suffix: string;
  science: string;
  arts: string;
  media: string;
  auditorium: VenueRow;
  seminar: VenueRow;
  lectureHall: VenueRow;
  lateStudio: VenueRow;
  oldGym: VenueRow;
  /** The four active venues. */
  active: VenueRow[];
}

/** FX-SEARCH's five venues (tests/J1/README.md): four active, and FX Old Gym, made inactive. */
export async function fxVenues(): Promise<FxVenues> {
  const suffix = uniqueName("").trim();
  const science = `FX Science Block ${suffix}`;
  const arts = `FX Arts Building ${suffix}`;
  const media = `FX Media Centre ${suffix}`;
  const make = (name: string, overrides: Record<string, unknown>) =>
    createVenue({ name: `${name} ${suffix}`, operatingHours: STANDARD_HOURS, ...overrides });

  const auditorium = await make("FX Auditorium", {
    building: science,
    maxCapacity: 300,
    layouts: [
      { name: "Theatre", capacity: 300 },
      { name: "Classroom", capacity: 120 },
    ],
    facilities: ["Projector", "Wireless microphones"],
    accessibilityFeatures: ["Step-free access", "Hearing loop"],
  });
  const seminar = await make("FX Seminar Room", {
    building: science,
    maxCapacity: 60,
    layouts: [
      { name: "Classroom", capacity: 40 },
      { name: "Boardroom", capacity: 20 },
    ],
    facilities: ["Projector"],
    accessibilityFeatures: ["Step-free access"],
  });
  const lectureHall = await make("FX Lecture Hall", {
    building: arts,
    maxCapacity: 200,
    layouts: [
      { name: "Theatre", capacity: 200 },
      { name: "Classroom", capacity: 80 },
    ],
    facilities: ["Projector", "Wireless microphones", "Stage lighting"],
    accessibilityFeatures: ["Step-free access", "Hearing loop", "Accessible toilet"],
  });
  const lateStudio = await make("FX Late Studio", {
    building: media,
    maxCapacity: 100,
    layouts: [{ name: "Theatre", capacity: 100 }],
    facilities: ["Projector"],
    accessibilityFeatures: ["Step-free access"],
    operatingHours: LATE_HOURS,
  });
  const oldGymBody = {
    building: arts,
    maxCapacity: 500,
    layouts: [{ name: "Theatre", capacity: 500 }],
    facilities: ["Projector", "Wireless microphones", "Stage lighting"],
    accessibilityFeatures: ["Step-free access", "Hearing loop", "Accessible toilet"],
    operatingHours: STANDARD_HOURS,
  };
  const oldGym = await make("FX Old Gym", oldGymBody);
  await makeInactive(oldGym, oldGymBody);
  return { suffix, science, arts, media, auditorium, seminar, lectureHall, lateStudio, oldGym, active: [auditorium, seminar, lectureHall, lateStudio] };
}

/** A hold on a venue for an event of its own, placed by the venue's Venue Staff with an expiry before the period. */
async function placedHold(venue: VenueRow, startsAt: string, endsAt: string): Promise<HoldRow> {
  const event = await approvedRequest();
  const hold = await must<HoldRow>("coordinator", "POST", "/api/v1/holds", {
    eventId: event.id,
    venueId: venue.id,
    startsAt,
    endsAt,
    reminderLeadMinutes: 1440,
  });
  await must("venuestaff", "POST", `/api/v1/holds/${hold.id}/place`, { expiresAt: "2027-03-01T10:00:00.000Z" });
  return hold;
}

/**
 * FX-SEARCH's commitments (tests/J1/README.md), on Monday 8 March and Wednesday 10 March 2027:
 * a confirmed booking at FX Auditorium 10:00-12:00, a hold at FX Seminar Room 14:00-16:00, a
 * released slot at FX Lecture Hall 15:00-17:00, its active maintenance block 09:00-13:00 and its
 * removed renovation block on Wednesday 09:00-13:00. (J1-FX-OCCUPIED, the Tuesday booking with its
 * own setup and turnaround, is left out: none of these cards uses it.)
 */
export async function fxCommitments(fx: FxVenues) {
  const monday = (time: string) => sgt(DAYS.monday, time);
  const bookedEvent = await approvedRequest();
  const booking = await requestBooking(bookedEvent.id, fx.auditorium.id, {
    startsAt: monday("10:00"),
    endsAt: monday("12:00"),
    layout: "Theatre",
    expectedAttendance: 100,
  });
  await approveBooking(booking.id);

  const held = await placedHold(fx.seminar, monday("14:00"), monday("16:00"));

  const released = await placedHold(fx.lectureHall, monday("15:00"), monday("17:00"));
  await must("coordinator", "POST", `/api/v1/holds/${released.id}/release`);

  const blocks = `/api/v1/venues/${fx.lectureHall.id}/unavailability`;
  await must("venuestaff", "POST", blocks, {
    startsAt: monday("09:00"),
    endsAt: monday("13:00"),
    reasonType: "MAINTENANCE",
    description: "J1 fixture: stage lighting rewiring",
  });
  const renovation = await must<{ block: { id: string } }>("venuestaff", "POST", blocks, {
    startsAt: sgt(DAYS.wednesday, "09:00"),
    endsAt: sgt(DAYS.wednesday, "13:00"),
    reasonType: "RENOVATION",
    description: "J1 fixture: seat replacement",
  });
  await must("venuestaff", "POST", `${blocks}/${renovation.block.id}/remove`, {});
  return { booking, held, released };
}

/** FX-SUITABILITY's venue (tests/K1/README.md), with a name no other run has used. */
export function k1Venue() {
  return createVenue({
    name: uniqueName("K1 Test Hall"),
    maxCapacity: 120,
    layouts: [
      { name: "Theatre", capacity: 120 },
      { name: "Classroom", capacity: 60 },
    ],
    facilities: ["Projector", "Microphone", "Livestream"],
    accessibilityFeatures: ["Step-free entrance", "Hearing loop"],
  });
}

/**
 * One of FX-SUITABILITY's events, Approved and assigned to Coordinator One. Unless a card says
 * otherwise it is on Monday 8 March 2027 (the card's Monday 7 December), 10:00-12:00, in the Theatre
 * layout, for 100 attendees, with no facility or accessibility need.
 */
export function k1Event(name: string, overrides: Record<string, unknown> = {}): Promise<EventRow> {
  return approvedRequest({
    name: uniqueName(name),
    expectedAttendance: 100,
    venueRequirements: { layout: "Theatre" },
    accessibilityNeeds: "",
    proposedStartAt: sgt(DAYS.monday, "10:00"),
    proposedEndAt: sgt(DAYS.monday, "12:00"),
    ...overrides,
  });
}

export interface VenueArrangements {
  event: EventRow;
  confirmedAt: VenueRow;
  heldAt: VenueRow;
  requestedAt: VenueRow;
  booking: BookingRequestRow;
  hold: HoldRow;
  pending: BookingRequestRow;
}

/**
 * L4-T5's pre-conditions: one event with a confirmed booking at one venue, a placed hold at a
 * second and a pending request for a third, all for the event's own period (14:00-18:00 on
 * Tuesday 2 March 2027, the cards' 2 December 2026).
 */
export async function venueArrangements(): Promise<VenueArrangements> {
  const event = await approvedRequest();
  const confirmedAt = await createVenue({ name: uniqueName("Lee Kong Chian Auditorium") });
  const heldAt = await createVenue({ name: uniqueName("Seminar Room 2-1") });
  const requestedAt = await createVenue({ name: uniqueName("Mochtar Riady Hall") });

  const booking = await requestBooking(event.id, confirmedAt.id);
  await approveBooking(booking.id);
  const hold = await must<HoldRow>("coordinator", "POST", "/api/v1/holds", {
    eventId: event.id,
    venueId: heldAt.id,
    startsAt: "2027-03-02T06:00:00.000Z",
    endsAt: "2027-03-02T10:00:00.000Z",
    reminderLeadMinutes: 1440,
  });
  await must("venuestaff", "POST", `/api/v1/holds/${hold.id}/place`, { expiresAt: "2027-03-01T10:00:00.000Z" });
  const pending = await requestBooking(event.id, requestedAt.id);
  return { event, confirmedAt, heldAt, requestedAt, booking, hold, pending };
}
