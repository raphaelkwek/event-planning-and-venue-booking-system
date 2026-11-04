import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { must } from "./api.js";
import { uniqueName } from "./names.js";
import { createEquipmentType, requestChange, requestEquipment, reserveInFull, setLineStatus, type EquipmentTypeRow } from "./seed-arrangements.js";
import { query } from "./seed-events.js";
import { approveBooking, eventBookings, requestBooking } from "./seed-venues.js";
import { approvedRequest, createVenue, type EventRow, type VenueRow } from "./seed.js";

/**
 * Setup for the equipment-inventory (P1, P2) and change-preview (G2) journeys: the SQL fixtures
 * the cards name, run against the job's own throwaway database, and the FX-G2 event with its
 * arrangements built through the API.
 */

/**
 * Runs a card fixture file under tests/ (for example `P2/fixtures/reserved-bulk-stock.sql`) as the
 * card says to, in the SQL editor. The Playwright config has already refused any DATABASE_URL that
 * is not on this machine, so this can only ever reach the job's own database.
 */
export async function runCardFixture(pathUnderTests: string) {
  const file = fileURLToPath(new URL(`../../${pathUnderTests}`, import.meta.url));
  await query(readFileSync(file, "utf8"));
}

/** An equipment type as P2-T1 leaves it: Technical Support create it, with its description and one characteristic. */
export function wirelessMicrophone() {
  return must<EquipmentTypeRow & { description: string }>("techsupport", "POST", "/api/v1/equipment/types", {
    name: uniqueName("P2 Wireless Microphone"),
    description: "Handheld wireless microphone for talks and panels.",
    characteristics: { "Frequency band": "534–598 MHz" },
    kind: "BULK",
    totalQuantity: 20,
    unitLabels: [],
  });
}

/** 2 March 2027 is the standard request's day; the change moves its start from 14:00 to 15:00 Singapore time. */
export const MOVED_START = "2027-03-02T07:00:00.000Z";

export interface PlannedEvent {
  event: EventRow;
  /** V1 "Venue One": Theatre, 100 places. */
  venueOne: VenueRow;
  /** V2 "Venue Two": Hall, 200 places. */
  venueTwo: VenueRow;
  /** B1 at V1 and B2 at V2, as the event's confirmed bookings show them. */
  theatreBooking: { reference: string; venueName: string };
  hallBooking: { reference: string; venueName: string };
  /** R1: the equipment type reserved for the event. */
  chairs: EquipmentTypeRow;
  reservedQuantity: number;
}

/**
 * FX-G2 at browser level (tests/G2/README.md): an Approved request of `organiser`, assigned to
 * `coordinator` and expecting 80 people, with a confirmed booking at each of two venues (Theatre
 * 100 and Hall 200) and a reservation of 4 chairs by Technical Support, all for the event's own
 * period, taken to Planning, and the organiser's pending change request with `changes`.
 *
 * Every arrangement is made through the API as the user who would make it. No route moves an
 * Approved event to Planning without the Safety Officer, so the status is set the way the
 * planning-core tests do it (a direct update), after the arrangements exist.
 */
export async function plannedEvent(changes: Record<string, unknown>): Promise<PlannedEvent> {
  const event = await approvedRequest({ expectedAttendance: 80 });
  const venueOne = await createVenue({ name: uniqueName("Venue One"), maxCapacity: 100, layouts: [{ name: "Theatre", capacity: 100 }] });
  const venueTwo = await createVenue({ name: uniqueName("Venue Two"), maxCapacity: 200, layouts: [{ name: "Hall", capacity: 200 }] });
  for (const [venue, layout] of [
    [venueOne, "Theatre"],
    [venueTwo, "Hall"],
  ] as const) {
    const request = await requestBooking(event.id, venue.id, { layout, expectedAttendance: 80 });
    await approveBooking(request.id);
  }

  const reservedQuantity = 4;
  const chairs = await createEquipmentType("G2 Chairs", 20);
  const [line] = await requestEquipment(event.id, [{ equipmentTypeId: chairs.id, quantity: reservedQuantity }]);
  await setLineStatus(line!.id, "CONFIRMED");
  await reserveInFull(line!.id);

  await query("update event.events set status = 'PLANNING' where id = $1", [event.id]);
  await requestChange(event.id, changes, "G2 browser walk-through");

  const { bookings } = await eventBookings(event.id);
  const bookingAt = (venue: VenueRow) => {
    const found = bookings.find((booking) => booking.venueId === venue.id);
    if (!found) throw new Error(`No confirmed booking at ${venue.name}`);
    return { reference: found.reference, venueName: found.venueName };
  };
  return { event, venueOne, venueTwo, theatreBooking: bookingAt(venueOne), hallBooking: bookingAt(venueTwo), chairs, reservedQuantity };
}
