import {
  BOOKING_REQUEST_STATUS_LABELS,
  EVENT_STATUS_LABELS,
  type BookingRequestStatus,
  type ErrorField,
  type EventStatus,
  type SuitabilityStatus,
} from "@connectsphere/contracts";
import type { ConditionResult, SuitabilityAssessment } from "./suitability.js";

/**
 * L1, L2 — a venue booking request's rules. Whether two requests overlap is the
 * exclusion constraint's decision (migration venue/0005, ADR-0006); these rules
 * only recognise its refusal and say what it means.
 */

export const DUPLICATE_REQUEST_CONSTRAINT = "booking_request_no_duplicate_pending";

/** Postgres exclusion_violation. */
const EXCLUSION_VIOLATION = "23P01";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** An instant with its offset, so it never depends on the server's time zone. */
// Stryker disable next-line Regex: dropping `$` is equivalent, as Date.parse refuses any text after the offset; `^` is tested.
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;
const INSTANT_MESSAGE = "Enter a date and time with its offset, for example 2026-12-02T14:00+08:00.";

export interface BookingRequestInput {
  eventId: string;
  venueId: string;
  /** UTC instants. */
  startsAt: string;
  endsAt: string;
  layout: string;
  expectedAttendance: number;
  facilities: string[];
  accessibilityFeatures: string[];
  /** CR-02 (L5): the disrupted confirmed booking this request would replace. */
  replacesBookingId: string | null;
  /** K2: why the coordinator requests a venue that isn't suitable, trimmed; null when none was sent. */
  justification: string | null;
}

/** A date and time with its offset, as a UTC instant; null when it isn't one. I2 reads a block's times the same way. */
export function instant(value: unknown): string | null {
  if (typeof value !== "string" || !INSTANT.test(value)) return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

/** Trimmed names, blanks and repeats (ignoring case) dropped; null when it isn't a list of strings. */
function names(value: unknown): string[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) return null;
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const item of value as string[]) {
    const name = item.trim();
    if (name === "" || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    kept.push(name);
  }
  return kept;
}

/** The request as sent, checked for shape, or every field that is wrong with it. */
export function readBookingRequest(body: unknown): { ok: true; request: BookingRequestInput } | { ok: false; fields: ErrorField[] } {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, fields: [{ field: "body", message: "Send the request as a JSON object." }] };
  }
  const b = body as Record<string, unknown>;
  const fields: ErrorField[] = [];

  const eventId = typeof b.eventId === "string" && UUID.test(b.eventId) ? b.eventId : null;
  if (!eventId) fields.push({ field: "eventId", message: "Choose the event." });
  const venueId = typeof b.venueId === "string" && UUID.test(b.venueId) ? b.venueId : null;
  if (!venueId) fields.push({ field: "venueId", message: "Choose a venue." });

  const startsAt = instant(b.startsAt);
  const endsAt = instant(b.endsAt);
  if (!startsAt) fields.push({ field: "startsAt", message: INSTANT_MESSAGE });
  if (!endsAt) fields.push({ field: "endsAt", message: INSTANT_MESSAGE });
  else if (startsAt && endsAt <= startsAt) fields.push({ field: "endsAt", message: "The end must be after the start." });

  const layout = typeof b.layout === "string" ? b.layout.trim() : "";
  if (layout === "") fields.push({ field: "layout", message: "Choose a room layout." });

  const attendance = b.expectedAttendance;
  if (!Number.isInteger(attendance) || (attendance as number) < 1) {
    fields.push({ field: "expectedAttendance", message: "Expected attendance must be a whole number greater than zero." });
  }

  const facilities = names(b.facilities);
  if (!facilities) fields.push({ field: "facilities", message: "Must be a list of names." });
  const accessibilityFeatures = names(b.accessibilityFeatures);
  if (!accessibilityFeatures) fields.push({ field: "accessibilityFeatures", message: "Must be a list of names." });

  const replaces = b.replacesBookingId ?? null;
  if (replaces !== null && !(typeof replaces === "string" && UUID.test(replaces))) {
    fields.push({ field: "replacesBookingId", message: "Must be the id of the booking to replace." });
  }

  const sent = b.justification ?? null;
  if (sent !== null && typeof sent !== "string") {
    fields.push({ field: "justification", message: "The justification must be text." });
  }

  if (fields.length > 0) return { ok: false, fields };
  return {
    ok: true,
    request: {
      eventId: eventId!,
      venueId: venueId!,
      startsAt: startsAt!,
      endsAt: endsAt!,
      layout,
      expectedAttendance: attendance as number,
      facilities: facilities!,
      accessibilityFeatures: accessibilityFeatures!,
      replacesBookingId: replaces as string | null,
      justification: sent === null ? null : (sent as string).trim(),
    },
  };
}

/** Once an event is approved, and until it is over, its coordinator can request venues for it. */
const BOOKABLE: readonly EventStatus[] = ["APPROVED", "PLANNING", "SAFETY_REVIEW", "CONFIRMED"];

export function eventBookable(status: EventStatus): boolean {
  return BOOKABLE.includes(status);
}

export function notBookableMessage(status: EventStatus): string {
  const labels = BOOKABLE.map((s) => EVENT_STATUS_LABELS[s]);
  const listed = `${labels.slice(0, -1).join(", ")} or ${labels[labels.length - 1]}`;
  return `A venue can be requested once the event is approved: while it is ${listed}. It is ${EVENT_STATUS_LABELS[status]}.`;
}

/** The venue's own spelling of the layout asked for, ignoring case; null when it has none. */
export function layoutAt(layouts: readonly { name: string }[], layout: string): string | null {
  return layouts.find((l) => l.name.toLowerCase() === layout.toLowerCase())?.name ?? null;
}

export type Difference =
  | { field: "startsAt" | "endsAt"; event: string; requested: string }
  | { field: "expectedAttendance"; event: number; requested: number };

/** Each of the date, times and attendance the request changes from the event's (L1). */
export function differencesFromEvent(
  event: { startsAt: string; endsAt: string; attendance: number },
  request: { startsAt: string; endsAt: string; expectedAttendance: number },
): Difference[] {
  const differences: Difference[] = [];
  if (Date.parse(request.startsAt) !== Date.parse(event.startsAt)) {
    differences.push({ field: "startsAt", event: event.startsAt, requested: request.startsAt });
  }
  if (Date.parse(request.endsAt) !== Date.parse(event.endsAt)) {
    differences.push({ field: "endsAt", event: event.endsAt, requested: request.endsAt });
  }
  if (request.expectedAttendance !== event.attendance) {
    differences.push({ field: "expectedAttendance", event: event.attendance, requested: request.expectedAttendance });
  }
  return differences;
}

/** Only the coordinator assigned to the event requests or withdraws its venues (L1, L2). */
export function isAssignedCoordinator(userId: string, event: { assignedCoordinatorId: string | null }): boolean {
  return userId === event.assignedCoordinatorId;
}

/** True when a database error is the constraint refusing a second pending request (L1-T8). */
export function isDuplicatePending(error: unknown): boolean {
  const e = error as { code?: unknown; constraint_name?: unknown } | null | undefined;
  return e?.code === EXCLUSION_VIOLATION && e.constraint_name === DUPLICATE_REQUEST_CONSTRAINT;
}

/**
 * Names every pending request the new one overlaps. The list can be empty if the
 * other was withdrawn between the refusal and the look-up; the refusal still
 * stands, because the constraint decided.
 */
export function duplicateMessage(references: readonly string[]): string {
  const named =
    references.length === 0
      ? "another pending request"
      : references.length === 1
        ? references[0]!
        : `${references.slice(0, -1).join(", ")} and ${references[references.length - 1]}`;
  return `This event already has a pending request for this venue that overlaps this period: ${named}. Withdraw it, or choose a period that doesn't overlap it.`;
}

/** L2, M1, M2: only a pending request can be withdrawn, approved or rejected. */
export function notPendingMessage(reference: string, status: BookingRequestStatus, action: "withdrawn" | "approved" | "rejected"): string {
  return `${reference} is ${BOOKING_REQUEST_STATUS_LABELS[status]}, so it can't be ${action}. Only a pending request can be.`;
}

/** K2: what a request records about its venue's suitability when it is submitted. */
export interface SuitabilityRecord {
  suitabilityStatus: SuitabilityStatus;
  /** The failing conditions as evaluated now: a snapshot later venue changes don't touch. */
  suitabilityReasons: ConditionResult[];
  justification: string | null;
}

export const JUSTIFICATION_MESSAGE = "Give a justification: at least one character that isn't a space.";

export function notSuitableMessage(venueName: string): string {
  return `${venueName} is not suitable for this request. Give a justification to request it anyway.`;
}

/**
 * K2 — a venue that isn't suitable can still be requested, but only with a
 * justification of at least one character that isn't a space. A suitable venue,
 * with or without warnings, needs none, and one sent anyway isn't kept.
 */
export function suitabilityRecord(
  assessment: SuitabilityAssessment,
  justification: string | null,
): { ok: true; record: SuitabilityRecord } | { ok: false } {
  if (assessment.status !== "NOT_SUITABLE") {
    return { ok: true, record: { suitabilityStatus: assessment.status, suitabilityReasons: [], justification: null } };
  }
  if (justification === null || !/\S/.test(justification)) return { ok: false };
  return {
    ok: true,
    record: { suitabilityStatus: "NOT_SUITABLE", suitabilityReasons: [...assessment.reasons], justification },
  };
}
