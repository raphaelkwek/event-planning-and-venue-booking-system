import {
  UNAVAILABILITY_REASON_LABELS,
  type BlockingSlotStatus,
  type ErrorField,
  type UnavailabilityReasonType,
} from "@connectsphere/contracts";
import { CALENDAR_TIME_ZONE } from "./availabilityCalendar.js";

/**
 * M1, M2 — Venue Staff decide a booking request. Whether an approval's booking
 * overlaps another is the exclusion constraint's decision (N1, ADR-0006); these
 * rules read a rejection and explain a refused approval.
 */

export const NOT_VENUE_STAFF = "Only the venue's Venue Staff can decide its requests.";

const MAX_TEXT = 1000;
const NOTHING_APPROVED = "Nothing was approved, and the request is still Pending.";

/** A rejection as sent: its reason, and any suggested alternative dates or venues (M2). */
export function readRejection(
  body: unknown,
): { ok: true; reason: string; suggestion: string | null } | { ok: false; fields: ErrorField[] } {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, fields: [{ field: "body", message: "Send the rejection as a JSON object." }] };
  }
  const b = body as Record<string, unknown>;
  const fields: ErrorField[] = [];

  const reason = typeof b.reason === "string" ? b.reason.trim() : "";
  if (reason === "") fields.push({ field: "reason", message: "Enter the reason for rejecting the request." });
  else if (reason.length > MAX_TEXT) fields.push({ field: "reason", message: `Keep the reason to ${MAX_TEXT} characters or fewer.` });

  let suggestion: string | null = null;
  if (typeof b.suggestion === "string") {
    suggestion = b.suggestion.trim() || null;
    if (suggestion && suggestion.length > MAX_TEXT) {
      fields.push({ field: "suggestion", message: `Keep the suggestion to ${MAX_TEXT} characters or fewer.` });
    }
  } else if (b.suggestion !== undefined && b.suggestion !== null) {
    fields.push({ field: "suggestion", message: "The suggestion must be text." });
  }

  return fields.length > 0 ? { ok: false, fields } : { ok: true, reason, suggestion };
}

/** A period in Singapore time, where the venues are: one day, or both ends when it crosses midnight. */
export function singaporePeriod(from: string, until: string): string {
  const parts = (iso: string) => {
    const p = new Intl.DateTimeFormat("en-GB", {
      timeZone: CALENDAR_TIME_ZONE,
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(iso));
    const part = (type: string) => p.find((x) => x.type === type)!.value;
    return { day: `${part("weekday")} ${part("day")} ${part("month")} ${part("year")}`, time: `${part("hour")}:${part("minute")}` };
  };
  const start = parts(from);
  const end = parts(until);
  return start.day === end.day ? `${start.day}, ${start.time}–${end.time}` : `${start.day} ${start.time} to ${end.day} ${end.time}`;
}

/** "A", "A and B", "A, B and C". I2 names blocks the same way. */
export function listed(items: readonly string[]): string {
  if (items.length === 1) return items[0]!;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export interface ConflictingBooking {
  eventReference: string | null;
  status: BlockingSlotStatus;
  occupiedFrom: string;
  occupiedUntil: string;
}

/**
 * M1-T4, M1-T6: names each booking or hold the approval overlaps, with its
 * occupied period. The list can be empty if the other was released between the
 * refusal and the look-up; the refusal still stands, because the constraint decided.
 */
export function bookingConflictMessage(reference: string, venueName: string, conflicts: readonly ConflictingBooking[]): string {
  const overlapped =
    conflicts.length === 0
      ? `the period overlaps another booking at ${venueName}`
      : `${venueName} is already ${listed(
          conflicts.map(
            (c) =>
              `${c.status === "HELD" ? "held" : "booked"} for ${c.eventReference ?? "another event"} (${singaporePeriod(c.occupiedFrom, c.occupiedUntil)})`,
          ),
        )}`;
  return `${reference} wasn't approved: ${overlapped}, counting setup and turnaround time. ${NOTHING_APPROVED}`;
}

export interface UnavailablePeriod {
  reasonType: UnavailabilityReasonType;
  description: string;
  startsAt: string;
  endsAt: string;
}

/** M1-T5: names each period of recorded unavailability the approval overlaps, with its type and reason. */
export function unavailableMessage(reference: string, venueName: string, blocks: readonly UnavailablePeriod[]): string {
  const periods = blocks.map(
    (b) => `${UNAVAILABILITY_REASON_LABELS[b.reasonType]}, “${b.description}” (${singaporePeriod(b.startsAt, b.endsAt)})`,
  );
  return `${reference} wasn't approved: ${venueName} is unavailable for ${listed(periods)}. ${NOTHING_APPROVED}`;
}
