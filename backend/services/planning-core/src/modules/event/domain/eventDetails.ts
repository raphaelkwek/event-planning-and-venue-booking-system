import {
  EVENT_STATUS_LABELS,
  isSignificantEventField,
  type ErrorField,
  type EventStatus,
} from "@connectsphere/contracts";

/**
 * G1 — editing an event's descriptive details during planning, without
 * touching what arrangements depend on. The significant fields are listed once,
 * in contracts (SIGNIFICANT_EVENT_FIELDS); they change only through a change
 * request (S1, S2).
 */

export const DETAIL_FIELDS = ["purpose", "description", "accessibilityNeeds", "contactDetails"] as const;
export type DetailField = (typeof DETAIL_FIELDS)[number];
export type Details = Record<DetailField, string | null>;

/** Required by B2, so an edit can't empty them. */
const REQUIRED: Partial<Record<DetailField, string>> = { purpose: "Purpose", description: "Description" };

/**
 * Approved, Planning and Confirmed are G1's. Safety Review (CR-06) sits between
 * Planning and Confirmed and was added after G1; the team decided on 11 Oct
 * 2026 that details stay editable during it for the time being.
 */
const EDITABLE_STATUSES: readonly EventStatus[] = ["APPROVED", "PLANNING", "SAFETY_REVIEW", "CONFIRMED"];

export function detailsEditableIn(status: EventStatus): boolean {
  return EDITABLE_STATUSES.includes(status);
}

export function notEditableMessage(status: EventStatus): string {
  const labels = EDITABLE_STATUSES.map((s) => EVENT_STATUS_LABELS[s]);
  const listed = `${labels.slice(0, -1).join(", ")} or ${labels[labels.length - 1]}`;
  return `Details can be edited only while the event is ${listed}. It is ${EVENT_STATUS_LABELS[status]}.`;
}

/** The owning organiser, or the coordinator currently assigned to the event. */
export function mayEditDetails(
  actor: { userId: string; role: string },
  event: { ownerId: string; assignedCoordinatorId: string | null },
): boolean {
  if (actor.role === "EVENT_ORGANISER") return actor.userId === event.ownerId;
  if (actor.role === "EVENT_COORDINATOR") return actor.userId === event.assignedCoordinatorId;
  return false;
}

type DetailsEdit =
  | { ok: true; changes: Partial<Details> }
  | { ok: false; reason: "CHANGE_REQUEST_REQUIRED" | "INVALID"; fields: ErrorField[] };

/**
 * The edit's changes, or why it is refused. Any significant field refuses the
 * whole edit, even alongside valid changes, so nothing is stored (G1-T6).
 */
export function readDetailsEdit(body: unknown): DetailsEdit {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, reason: "INVALID", fields: [{ field: "body", message: "Send the changed fields as a JSON object." }] };
  }
  const entries = Object.entries(body);

  const significant = entries.filter(([field]) => isSignificantEventField(field)).map(([field]) => field);
  if (significant.length > 0) {
    return {
      ok: false,
      reason: "CHANGE_REQUEST_REQUIRED",
      fields: significant.map((field) => ({ field, message: "Change this through a change request." })),
    };
  }

  const fields: ErrorField[] = [];
  const changes: Partial<Details> = {};
  for (const [field, value] of entries) {
    if (!(DETAIL_FIELDS as readonly string[]).includes(field)) {
      fields.push({ field, message: "This field can't be edited here." });
      continue;
    }
    if (value !== null && typeof value !== "string") {
      fields.push({ field, message: "Must be text." });
      continue;
    }
    const text = value === null ? "" : value.trim();
    const label = REQUIRED[field as DetailField];
    if (label && text === "") {
      fields.push({ field, message: `${label} is required.` });
      continue;
    }
    changes[field as DetailField] = text === "" ? null : text;
  }

  return fields.length > 0 ? { ok: false, reason: "INVALID", fields } : { ok: true, changes };
}

/** One entry per field whose value the edit changes, with its before and after (G1-T7). */
export function changedDetails(
  current: Details,
  changes: Partial<Details>,
): { fieldName: DetailField; previousValue: string | null; newValue: string | null }[] {
  return DETAIL_FIELDS.filter((field) => field in changes && changes[field] !== current[field]).map((field) => ({
    fieldName: field,
    previousValue: current[field],
    newValue: changes[field]!,
  }));
}

/** The event's version as an entity tag (ADR-0015). */
export function etag(version: number): string {
  return `"${version}"`;
}

/** The version an `If-Match` header names; versions start at 1. */
export function readIfMatch(header: string | undefined): number | "MISSING" | "UNREADABLE" {
  const value = (header ?? "").trim();
  if (value === "") return "MISSING";
  const match = /^(?:W\/)?"([1-9]\d*)"$/.exec(value);
  return match ? Number(match[1]) : "UNREADABLE";
}
