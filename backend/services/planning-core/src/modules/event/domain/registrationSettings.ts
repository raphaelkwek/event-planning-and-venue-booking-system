import { EVENT_STATUS_LABELS, type ErrorField, type EventStatus } from "@connectsphere/contracts";
import { REGISTRATION_AFTER_START_MESSAGE } from "./validation.js";

/**
 * R2, R4 — the registration settings the Event Organiser sets for their event:
 * whether attendees register, the registration window (R2), and an optional
 * withdrawal deadline (R4). The window was first given on the request (B2), and
 * the same rules apply when it is changed here. Pure: no I/O.
 */

export interface RegistrationSettings {
  registrationRequired: boolean;
  registrationOpensAt: string | null;
  registrationClosesAt: string | null;
  withdrawalDeadlineAt: string | null;
}

export const REGISTRATION_SETTING_FIELDS = [
  "registrationRequired",
  "registrationOpensAt",
  "registrationClosesAt",
  "withdrawalDeadlineAt",
] as const;
export type RegistrationSettingField = (typeof REGISTRATION_SETTING_FIELDS)[number];

const INSTANT_FIELDS = ["registrationOpensAt", "registrationClosesAt", "withdrawalDeadlineAt"] as const;

export const DEADLINE_AFTER_START_MESSAGE = "The withdrawal deadline must be no later than the event start.";
const NOT_AN_INSTANT = "Give a date and time, such as 2026-12-01T09:00:00+08:00.";
const ONLY_WITH_REGISTRATION = "Leave this empty when attendees don't register for the event.";

/** The statuses G1 edits details in: from approval until the event is over. */
const SETTABLE_STATUSES: readonly EventStatus[] = ["APPROVED", "PLANNING", "SAFETY_REVIEW", "CONFIRMED"];

export function registrationSettableIn(status: EventStatus): boolean {
  return SETTABLE_STATUSES.includes(status);
}

export function notSettableMessage(status: EventStatus): string {
  return `Registration settings can be changed only while the event is Approved, Planning, Safety Review or Confirmed. It is ${EVENT_STATUS_LABELS[status]}.`;
}

/** Only the owning organiser: R2 and R4 say the organiser sets them. */
export function maySetRegistration(actor: { userId: string; role: string }, event: { ownerId: string }): boolean {
  return actor.role === "EVENT_ORGANISER" && actor.userId === event.ownerId;
}

type SettingsRead = { ok: true; settings: RegistrationSettings } | { ok: false; fields: ErrorField[] };

/** An instant as the API stores it, or "invalid" for a value that is not one. Absent and null are null. */
function instantOf(value: unknown): string | null | "invalid" {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return "invalid";
  // A blank or unreadable string parses to NaN.
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? "invalid" : new Date(ms).toISOString();
}

/**
 * The settings in a request body, or every field that is wrong with them
 * (B2: name every field, not only the first). The body replaces all four: a
 * field left out is empty. `eventStartAt` is the event's start, which the
 * closing and the deadline may not pass.
 */
export function readRegistrationSettings(body: unknown, eventStartAt: string | null): SettingsRead {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, fields: [{ field: "body", message: "Send the registration settings as a JSON object." }] };
  }
  const input = body as Record<string, unknown>;
  const fields: ErrorField[] = Object.keys(input)
    .filter((field) => !(REGISTRATION_SETTING_FIELDS as readonly string[]).includes(field))
    .map((field) => ({ field, message: "This field can't be set here." }));

  const required = input.registrationRequired;
  if (typeof required !== "boolean") {
    fields.push({ field: "registrationRequired", message: "Say whether attendees register for this event: true or false." });
  }

  const instants: Record<(typeof INSTANT_FIELDS)[number], string | null> = {
    registrationOpensAt: null,
    registrationClosesAt: null,
    withdrawalDeadlineAt: null,
  };
  for (const field of INSTANT_FIELDS) {
    const value = instantOf(input[field]);
    if (value === "invalid") fields.push({ field, message: NOT_AN_INSTANT });
    else instants[field] = value;
  }
  if (fields.length > 0) return { ok: false, fields };

  const { registrationOpensAt: opens, registrationClosesAt: closes, withdrawalDeadlineAt: deadline } = instants;
  const start = eventStartAt === null ? null : Date.parse(eventStartAt);

  if (required === false) {
    for (const field of INSTANT_FIELDS) {
      if (instants[field] !== null) fields.push({ field, message: ONLY_WITH_REGISTRATION });
    }
  } else {
    if (opens === null) {
      fields.push({ field: "registrationOpensAt", message: "Registration opening date and time is required when registration is required." });
    }
    if (closes === null) {
      fields.push({ field: "registrationClosesAt", message: "Registration closing date and time is required when registration is required." });
    } else if (opens !== null && Date.parse(closes) <= Date.parse(opens)) {
      fields.push({ field: "registrationClosesAt", message: "Registration closing must be later than registration opening." });
    } else if (start !== null && Date.parse(closes) > start) {
      fields.push({ field: "registrationClosesAt", message: REGISTRATION_AFTER_START_MESSAGE });
    }
    if (deadline !== null && start !== null && Date.parse(deadline) > start) {
      fields.push({ field: "withdrawalDeadlineAt", message: DEADLINE_AFTER_START_MESSAGE });
    }
  }
  if (fields.length > 0) return { ok: false, fields };

  return {
    ok: true,
    settings: {
      registrationRequired: required as boolean,
      registrationOpensAt: opens,
      registrationClosesAt: closes,
      withdrawalDeadlineAt: deadline,
    },
  };
}

/** How a setting is written in the event's field history. */
function historyValue(value: boolean | string | null): string | null {
  return value === null ? null : String(value);
}

/** One history entry per setting the save changes, with its before and after (as G1 records them). */
export function changedSettings(
  current: RegistrationSettings,
  next: RegistrationSettings,
): { fieldName: RegistrationSettingField; previousValue: string | null; newValue: string | null }[] {
  return REGISTRATION_SETTING_FIELDS.filter((field) => current[field] !== next[field]).map((field) => ({
    fieldName: field,
    previousValue: historyValue(current[field]),
    newValue: historyValue(next[field]),
  }));
}
