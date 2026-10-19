import {
  EVENT_STATUS_LABELS,
  HOLD_STATUS_LABELS,
  type ErrorField,
  type EventStatus,
  type HoldStatus,
} from "@connectsphere/contracts";
import { CALENDAR_TIME_ZONE } from "./availabilityCalendar.js";
import { INSTANT_MESSAGE, UUID, instant } from "./bookingRequest.js";

/**
 * L3 — a tentative hold's rules. The event's assigned coordinator requests a
 * hold; Venue Staff of the venue place it, setting its expiry (the customer's
 * Week 9 answer, CQ-06). Who gets a period is the exclusion constraint's
 * decision when a hold is placed (migration venue/0003, ADR-0006): these rules
 * only read what was sent and word the refusals.
 */

export const LIVE_HOLD_INDEX = "holds_one_live_per_event_and_venue";

/** Postgres unique_violation. */
const UNIQUE_VIOLATION = "23505";

export interface HoldRequestInput {
  eventId: string;
  venueId: string;
  /** UTC instants. */
  startsAt: string;
  endsAt: string;
  /** How long before the expiry to remind the coordinator (L6). */
  reminderLeadMinutes: number;
}

const REMINDER_MESSAGE = "Enter a whole number of minutes, at least 1.";

/** The hold request as sent, checked for shape, or every field that is wrong with it. */
export function readHoldRequest(body: unknown): { ok: true; hold: HoldRequestInput } | { ok: false; fields: ErrorField[] } {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, fields: [{ field: "body", message: "Send the hold as a JSON object." }] };
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

  const lead = b.reminderLeadMinutes;
  if (!Number.isInteger(lead) || (lead as number) < 1) fields.push({ field: "reminderLeadMinutes", message: REMINDER_MESSAGE });

  if (fields.length > 0) return { ok: false, fields };
  return { ok: true, hold: { eventId: eventId!, venueId: venueId!, startsAt: startsAt!, endsAt: endsAt!, reminderLeadMinutes: lead as number } };
}

/** The expiry Venue Staff set when placing a hold: later than now (CR-04, L6). */
export function readPlacement(body: unknown, now: Date): { ok: true; expiresAt: string } | { ok: false; fields: ErrorField[] } {
  const raw = typeof body === "object" && body !== null ? (body as Record<string, unknown>).expiresAt : undefined;
  if (raw === undefined || raw === null || raw === "") {
    return { ok: false, fields: [{ field: "expiresAt", message: "Enter the expiry date and time." }] };
  }
  const expiresAt = instant(raw);
  if (!expiresAt) return { ok: false, fields: [{ field: "expiresAt", message: INSTANT_MESSAGE }] };
  if (Date.parse(expiresAt) <= now.getTime()) {
    return { ok: false, fields: [{ field: "expiresAt", message: "The expiry must be later than now." }] };
  }
  return { ok: true, expiresAt };
}

/** A venue can be held for an event that isn't over or turned down (L3). */
const NOT_HOLDABLE: readonly EventStatus[] = ["COMPLETED", "CANCELLED", "REJECTED"];

export function eventHoldable(status: EventStatus): boolean {
  return !NOT_HOLDABLE.includes(status);
}

export function notHoldableMessage(status: EventStatus): string {
  return `A venue can't be held for an event that is ${EVENT_STATUS_LABELS[status]}.`;
}

/** True when a database error is the index refusing a second live hold for the event and venue (L3-T11). */
export function isLiveHoldDuplicate(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const { code, constraint_name } = error as { code?: unknown; constraint_name?: unknown };
  return code === UNIQUE_VIOLATION && constraint_name === LIVE_HOLD_INDEX;
}

export function duplicateHoldMessage(reference: string, venueName: string): string {
  return `This event already has hold ${reference} at ${venueName}. Release it, or convert it into a booking request, before holding the venue again.`;
}

export interface OverlappedPeriod {
  reference: string;
  /** UTC instants: the other hold's or booking's own period, without its setup and turnaround. */
  startsAt: string;
  endsAt: string;
}

function listed(items: readonly string[]): string {
  if (items.length === 1) return items[0]!;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/**
 * Names every hold or booking the placement overlaps, with its period (L3-T8).
 * The list can be empty if the other was released between the refusal and the
 * look-up; the refusal still stands, because the constraint decided.
 */
export function holdConflictMessage(overlapped: readonly OverlappedPeriod[], venueName: string): string {
  const named =
    overlapped.length === 0
      ? "another hold or booking"
      : listed(overlapped.map((o) => `${o.reference} (${formatPeriod(o.startsAt, o.endsAt)})`));
  return `This period overlaps ${named} at ${venueName}. A held or booked period can't be taken by another event.`;
}

export function notRequestedMessage(reference: string, status: HoldStatus): string {
  return `${reference} is ${HOLD_STATUS_LABELS[status]}, so it can't be placed. Only a requested hold can be.`;
}

export function notHeldMessage(reference: string, status: HoldStatus): string {
  return `${reference} is ${HOLD_STATUS_LABELS[status]}, so it can't be converted. Only a hold Venue Staff have placed can be.`;
}

export function notReleasableMessage(reference: string, status: HoldStatus): string {
  return `${reference} is ${HOLD_STATUS_LABELS[status]}, so it can't be released. Only a requested or held hold can be.`;
}

/**
 * Until L6 marks holds Expired, a held hold past its expiry is refused
 * conversion here: an expired hold can't become a booking (L6, Week 9 answer).
 */
export function hasExpired(expiresAt: string, now: Date): boolean {
  return now.getTime() >= Date.parse(expiresAt);
}

export function expiredMessage(reference: string, expiresAt: string): string {
  return `${reference} expired on ${formatInstant(expiresAt)}, so it can't be converted. Ask for a new hold.`;
}

const DATE = new Intl.DateTimeFormat("en-GB", {
  timeZone: CALENDAR_TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const CLOCK = new Intl.DateTimeFormat("en-GB", { timeZone: CALENDAR_TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

function day(iso: string): string {
  const parts = DATE.formatToParts(new Date(iso));
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part("weekday")} ${part("day")} ${part("month")} ${part("year")}`;
}

/** "Tuesday 1 December 2026, 18:00", Singapore time. */
export function formatInstant(iso: string): string {
  return `${day(iso)}, ${CLOCK.format(new Date(iso))}`;
}

/** "Wednesday 2 December 2026, 14:00–18:00", Singapore time; an end at midnight is 24:00. */
export function formatPeriod(startsAt: string, endsAt: string): string {
  const end = CLOCK.format(new Date(endsAt));
  return `${day(startsAt)}, ${CLOCK.format(new Date(startsAt))}–${end === "00:00" ? "24:00" : end}`;
}
