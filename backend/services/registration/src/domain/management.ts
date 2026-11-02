import { placesRemaining } from "./registrationRules.js";

/**
 * R5, R7 — the organiser's side of registration, pure: who manages an event,
 * the totals of its list, what a manual addition would make, and what the
 * addition form may hold. No database, no clock.
 */

/** Who an event belongs to, from the registration service's copy of it. */
export interface ManagedEvent {
  ownerId: string;
  assignedCoordinatorId: string | null;
}

/**
 * R5, R7: only the owning organiser and the assigned coordinator see an event's
 * registrations and add attendees to it. Anyone else is answered as if the
 * event did not exist, so they receive no registration data.
 */
export function mayManage(event: ManagedEvent, userId: string): boolean {
  return userId === event.ownerId || userId === event.assignedCoordinatorId;
}

/** Statuses after which nobody is added: the event is over or will never happen. */
const CLOSED_STATUSES = new Set(["CANCELLED", "COMPLETED", "REJECTED"]);

/** R7: an event takes manual additions unless it was cancelled, rejected or has completed. */
export function takesAdditions(status: string): boolean {
  return !CLOSED_STATUSES.has(status);
}

/** The counts R5's totals come from: the registration records, and the seats R2 counts places with. */
export interface TotalsBasis {
  registered: number;
  withdrawn: number;
  cancelled: number;
  manuallyAdded: number;
  addedOverCapacity: number;
  capacity: number;
  freeSeats: number;
  unseatedRegistrations: number;
}

export interface RegistrationTotals {
  registered: number;
  withdrawn: number;
  cancelled: number;
  manuallyAdded: number;
  addedOverCapacity: number;
  capacity: number;
  placesRemaining: number;
  /** D-01: how many attendees are above capacity, 0 when within it. */
  overCapacityBy: number;
}

/**
 * R5: the totals shown above the list. Registered, withdrawn and cancelled count
 * the records in each status. Places remaining is R2's, so it matches what
 * attendees see; it is never negative (D-01).
 */
export function registrationTotals(basis: TotalsBasis): RegistrationTotals {
  return {
    registered: basis.registered,
    withdrawn: basis.withdrawn,
    cancelled: basis.cancelled,
    manuallyAdded: basis.manuallyAdded,
    addedOverCapacity: basis.addedOverCapacity,
    capacity: basis.capacity,
    placesRemaining: placesRemaining(basis.freeSeats, basis.unseatedRegistrations),
    overCapacityBy: Math.max(0, basis.registered - basis.capacity),
  };
}

/** R7 (D-01): what the organiser is shown before an addition is saved. */
export interface AdditionPreview {
  capacity: number;
  totalAfter: number;
  overCapacity: boolean;
}

/** R7 (D-01): the capacity, and the number of attendees the addition would make. */
export function additionPreview(capacity: number, registered: number): AdditionPreview {
  const totalAfter = registered + 1;
  return { capacity, totalAfter, overCapacity: totalAfter > capacity };
}

export const MAX_REASON_LENGTH = 500;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;

export interface AdditionRequest {
  attendeeEmail: string;
  reason: string | null;
  confirmOverCapacity: boolean;
}

export type FieldProblem = { field: string; message: string };

/**
 * R7: the addition form. The attendee is named by their account's email; the
 * reason is optional, up to 500 characters, and blank means none; going over
 * capacity must be confirmed with `confirmOverCapacity: true`.
 */
export function readAdditionRequest(body: unknown): { ok: true; value: AdditionRequest } | { ok: false; fields: FieldProblem[] } {
  const input = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const fields: FieldProblem[] = [];
  const email = typeof input.attendeeEmail === "string" ? input.attendeeEmail.trim() : "";
  if (!EMAIL.test(email) || email.length > MAX_EMAIL_LENGTH) {
    fields.push({ field: "attendeeEmail", message: "Give the email address of the attendee's account." });
  }
  const reasonGiven = input.reason !== undefined && input.reason !== null;
  if (reasonGiven && typeof input.reason !== "string") fields.push({ field: "reason", message: "The reason must be text." });
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  if (reason.length > MAX_REASON_LENGTH) fields.push({ field: "reason", message: `Keep the reason to ${MAX_REASON_LENGTH} characters.` });
  const confirm = input.confirmOverCapacity;
  if (confirm !== undefined && typeof confirm !== "boolean") {
    fields.push({ field: "confirmOverCapacity", message: "Say true to add above capacity." });
  }
  if (fields.length > 0) return { ok: false, fields };
  return { ok: true, value: { attendeeEmail: email, reason: reason === "" ? null : reason, confirmOverCapacity: confirm === true } };
}
