import type { AccountKey } from "./accounts.js";
import { must } from "./api.js";
import { uniqueName } from "./names.js";
import { STANDARD_END, STANDARD_START } from "./seed.js";

/**
 * Seeding for the equipment, confirmation and change journeys (O1, Q1, F5, S1, S2): equipment
 * types, request lines and their status, reservations, and a venue booking approved by its Venue
 * Staff, each through the API as the user who would do it.
 */

export interface EquipmentTypeRow {
  id: string;
  name: string;
  totalQuantity: number;
}

export interface RequestLineRow {
  id: string;
  status: string;
  quantity: number;
  equipmentTypeName: string;
  eventReference: string;
}

/** Technical Support create a bulk equipment type (P2), named uniquely. */
export function createEquipmentType(prefix: string, totalQuantity: number) {
  return must<EquipmentTypeRow>("techsupport", "POST", "/api/v1/equipment/types", {
    name: uniqueName(prefix),
    description: `${prefix} for the browser tests.`,
    characteristics: {},
    kind: "BULK",
    totalQuantity,
    unitLabels: [],
  });
}

/** The assigned coordinator records equipment lines for the event (O1), using the event's times. */
export async function requestEquipment(
  eventId: string,
  lines: { equipmentTypeId: string; quantity: number; notes?: string }[],
  coordinator: AccountKey = "coordinator",
) {
  const result = await must<{ items: RequestLineRow[] }>(coordinator, "POST", "/api/v1/equipment/request-lines", {
    eventId,
    lines: lines.map((line) => ({
      equipmentTypeId: line.equipmentTypeId,
      quantity: line.quantity,
      notes: line.notes ?? "",
      requiredFrom: STANDARD_START,
      requiredTo: STANDARD_END,
    })),
  });
  return result.items;
}

/** Technical Support set a line's status (O2), e.g. CONFIRMED. */
export function setLineStatus(lineId: string, status: "UNDER_REVIEW" | "CONFIRMED") {
  return must<RequestLineRow>("techsupport", "POST", `/api/v1/equipment/request-lines/${lineId}/status`, { status });
}

/** Technical Support reserve a Confirmed line in full (Q1). */
export function reserveInFull(lineId: string) {
  return must("techsupport", "POST", `/api/v1/equipment/request-lines/${lineId}/reservation`, {});
}

export interface BookingRequestRow {
  id: string;
  reference: string;
  status: string;
}

/**
 * The assigned coordinator requests the venue for the event's own period (L1) and the venue's
 * Venue Staff approve it (M1), so the event has a confirmed booking.
 */
export async function confirmedBooking(eventId: string, venueId: string, coordinator: AccountKey = "coordinator") {
  const request = await must<BookingRequestRow>(coordinator, "POST", "/api/v1/booking-requests", {
    eventId,
    venueId,
    startsAt: STANDARD_START,
    endsAt: STANDARD_END,
    layout: "Theatre",
    expectedAttendance: 150,
  });
  await must("venuestaff", "POST", `/api/v1/booking-requests/${request.id}/approve`, {});
  return request;
}

/** The owning organiser raises a change request (S1). */
export function requestChange(eventId: string, changes: Record<string, unknown>, reason: string, as: AccountKey = "organiser") {
  return must<{ id: string; status: string }>(as, "POST", `/api/v1/events/${eventId}/change-requests`, { reason, changes });
}
