import { must } from "./api.js";
import { approvedRequest, createVenue, type EventRow, type VenueRow } from "./seed.js";
import {
  confirmedBooking,
  createEquipmentType,
  requestEquipment,
  reserveInFull,
  setLineStatus,
  type EquipmentTypeRow,
} from "./seed-arrangements.js";

/**
 * Setup for the safety, confirmation and cancellation journeys (U1, F1, F3, F4): an event with a
 * confirmed venue booking and, when asked, a reserved equipment line, taken as far as the card
 * needs, each step done through the API as the user who would do it.
 */

export interface ArrangedEvent {
  event: EventRow;
  venue: VenueRow;
  chairs: EquipmentTypeRow | null;
  lineId: string | null;
}

/** FX-BOOKING: an Approved event whose venue booking is confirmed, with a reserved line when `withEquipment`. */
export async function arrangedEvent(withEquipment: boolean, prefix = "Chairs"): Promise<ArrangedEvent> {
  const event = await approvedRequest(
    withEquipment
      ? { equipmentRequired: true, equipmentRequirements: [{ equipmentType: "Folding chairs", quantity: 5 }] }
      : {},
  );
  const venue = await createVenue();
  await confirmedBooking(event.id, venue.id);
  if (!withEquipment) return { event, venue, chairs: null, lineId: null };

  const chairs = await createEquipmentType(prefix, 20);
  const [line] = await requestEquipment(event.id, [{ equipmentTypeId: chairs.id, quantity: 5, notes: "Rows along the north wall" }]);
  await setLineStatus(line!.id, "CONFIRMED");
  await reserveInFull(line!.id);
  return { event, venue, chairs, lineId: line!.id };
}

/** FX-U1: the arranged event, confirmed by its coordinator (F5), so it waits in Safety Review. */
export async function safetyReviewEvent(withEquipment = true): Promise<ArrangedEvent> {
  const arranged = await arrangedEvent(withEquipment, "U1 Chairs");
  await must("coordinator", "POST", `/api/v1/events/${arranged.event.id}/confirmation`);
  return arranged;
}
