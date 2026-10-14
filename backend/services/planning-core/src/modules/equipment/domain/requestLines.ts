import {
  EQUIPMENT_LINE_EDITABLE_STATUSES,
  EQUIPMENT_LINE_STAFF_STATUSES,
  type EquipmentLineStaffStatus,
  type EquipmentRequestLineStatus,
  type ErrorField,
} from "@connectsphere/contracts";

/**
 * O1/O2 rules for the lines of an event's equipment request, as pure functions:
 * what a valid line is, which lines may still be edited, and what a status change
 * needs. No database, no HTTP; the API and repo layers call these and act on the answer.
 */

export const MAX_LINES_PER_REQUEST = 50;
export const MAX_NOTES_LENGTH = 2000;
export const MAX_REASON_LENGTH = 1000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One line as the client sent it, before anything is trusted. */
export type RawLine = Record<string, unknown>;

/** The event's own times, which a line's required-from and required-to default to. */
export interface EventTimes {
  startsAt: Date | null;
  endsAt: Date | null;
}

export interface ValidLine {
  equipmentTypeId: string;
  quantity: number;
  notes: string;
  requiredFrom: Date;
  requiredTo: Date;
}

export type LineValidation = { ok: true; line: ValidLine } | { ok: false; fields: ErrorField[] };
export type LinesValidation = { ok: true; lines: ValidLine[] } | { ok: false; fields: ErrorField[] };

const field = (prefix: string, name: string, message: string): ErrorField => ({ field: `${prefix}${name}`, message });

function parseInstant(value: unknown): Date | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * One time of a line: the value the coordinator gave, or the event's own when they gave none.
 * A value that is given but is not a date is refused rather than quietly replaced by the default.
 */
function resolveInstant(
  given: unknown,
  fallback: Date | null,
  prefix: string,
  name: string,
  label: string,
  fields: ErrorField[],
): Date | null {
  if (given === undefined || given === null || given === "") {
    if (fallback) return fallback;
    fields.push(field(prefix, name, `Enter the ${label} date and time.`));
    return null;
  }
  const parsed = parseInstant(given);
  if (!parsed) fields.push(field(prefix, name, `Enter a valid ${label} date and time.`));
  return parsed;
}

/**
 * O1: a line needs an equipment type, a whole-number quantity above zero, and a period whose end
 * is later than its start. `prefix` places the field names (`lines.0.` for a new request, empty for
 * an edit). Every problem is reported, not only the first (§5).
 */
export function validateLine(raw: RawLine, event: EventTimes, prefix = ""): LineValidation {
  const fields: ErrorField[] = [];

  const equipmentTypeId = raw.equipmentTypeId;
  if (typeof equipmentTypeId !== "string" || !UUID.test(equipmentTypeId)) {
    fields.push(field(prefix, "equipmentTypeId", "Choose an equipment type."));
  }

  const quantity = raw.quantity;
  if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity <= 0) {
    fields.push(field(prefix, "quantity", "Quantity must be a whole number greater than zero."));
  }

  const notes = raw.notes ?? "";
  if (typeof notes !== "string") {
    fields.push(field(prefix, "notes", "Technical notes must be text."));
  } else if (notes.trim().length > MAX_NOTES_LENGTH) {
    fields.push(field(prefix, "notes", `Technical notes can be at most ${MAX_NOTES_LENGTH} characters.`));
  }

  const requiredFrom = resolveInstant(raw.requiredFrom, event.startsAt, prefix, "requiredFrom", "required-from", fields);
  const requiredTo = resolveInstant(raw.requiredTo, event.endsAt, prefix, "requiredTo", "required-to", fields);
  if (requiredFrom && requiredTo && requiredTo.getTime() <= requiredFrom.getTime()) {
    fields.push(field(prefix, "requiredTo", "Required-to must be later than required-from."));
  }

  if (fields.length > 0) return { ok: false, fields };
  return {
    ok: true,
    line: {
      equipmentTypeId: equipmentTypeId as string,
      quantity: quantity as number,
      notes: (notes as string).trim(),
      requiredFrom: requiredFrom!,
      requiredTo: requiredTo!,
    },
  };
}

/** O1: a request of one or more lines is saved whole or not at all, so every line is checked first. */
export function validateNewLines(raw: readonly RawLine[], event: EventTimes): LinesValidation {
  if (raw.length === 0) {
    return { ok: false, fields: [{ field: "lines", message: "Add at least one equipment line." }] };
  }
  if (raw.length > MAX_LINES_PER_REQUEST) {
    return { ok: false, fields: [{ field: "lines", message: `A request can have at most ${MAX_LINES_PER_REQUEST} lines.` }] };
  }
  const fields: ErrorField[] = [];
  const lines: ValidLine[] = [];
  raw.forEach((entry, index) => {
    const result = validateLine(entry, event, `lines.${index}.`);
    if (result.ok) lines.push(result.line);
    else fields.push(...result.fields);
  });
  return fields.length > 0 ? { ok: false, fields } : { ok: true, lines };
}

/** O1: the coordinator may edit or remove a line only while it is Submitted or Under Review. */
export function isEditableByCoordinator(status: EquipmentRequestLineStatus): boolean {
  return EQUIPMENT_LINE_EDITABLE_STATUSES.includes(status);
}

/** O2: Technical Support updates lines being arranged; a Reserved line is Q1's and a Removed line is gone. */
export function canChangeStatus(status: EquipmentRequestLineStatus): boolean {
  return status !== "RESERVED" && status !== "REMOVED";
}

/** What O2 asks for, once valid. The substitute is set only for a substitution, the reason only for Unavailable. */
export interface StatusChange {
  status: EquipmentLineStaffStatus;
  reason: string | null;
  substituteEquipmentTypeId: string | null;
  substituteQuantity: number | null;
}

export type StatusChangeValidation = { ok: true; change: StatusChange } | { ok: false; fields: ErrorField[] };

/** O2: Unavailable needs a reason; Substituted needs the substitute type and a whole-number quantity above zero. */
export function validateStatusChange(raw: RawLine): StatusChangeValidation {
  const status = raw.status;
  if (typeof status !== "string" || !(EQUIPMENT_LINE_STAFF_STATUSES as readonly string[]).includes(status)) {
    return {
      ok: false,
      fields: [{ field: "status", message: "Choose Under Review, Confirmed, Unavailable or Substituted." }],
    };
  }

  const fields: ErrorField[] = [];
  let reason: string | null = null;
  let substituteEquipmentTypeId: string | null = null;
  let substituteQuantity: number | null = null;

  if (status === "UNAVAILABLE") {
    const given = typeof raw.reason === "string" ? raw.reason.trim() : "";
    if (given === "") fields.push({ field: "reason", message: "Give a reason why the equipment is unavailable." });
    else if (given.length > MAX_REASON_LENGTH) {
      fields.push({ field: "reason", message: `The reason can be at most ${MAX_REASON_LENGTH} characters.` });
    } else reason = given;
  }

  if (status === "SUBSTITUTED") {
    const type = raw.substituteEquipmentTypeId;
    if (typeof type !== "string" || !UUID.test(type)) {
      fields.push({ field: "substituteEquipmentTypeId", message: "Choose the substitute equipment type." });
    } else substituteEquipmentTypeId = type;

    const quantity = raw.substituteQuantity;
    if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity <= 0) {
      fields.push({ field: "substituteQuantity", message: "Substitute quantity must be a whole number greater than zero." });
    } else substituteQuantity = quantity;
  }

  if (fields.length > 0) return { ok: false, fields };
  return { ok: true, change: { status: status as EquipmentLineStaffStatus, reason, substituteEquipmentTypeId, substituteQuantity } };
}
