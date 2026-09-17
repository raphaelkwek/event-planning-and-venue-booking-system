import { request } from "./client.js";
import type {
  Clarification,
  EquipmentRequirementLine,
  EventListItem,
  EventRecord,
  Paged,
  RequestFields,
  VenueRequirements,
} from "./types.js";

const EVENT = "/event/api/v1";

/** Turns the form's strings into the JSON body the service expects. */
export function toRequestBody(fields: RequestFields, { partial }: { partial: boolean }) {
  const optional = (value: string) => (value.trim().length > 0 ? value : partial ? undefined : null);
  const instant = (value: string) => (value.trim().length > 0 ? new Date(value).toISOString() : undefined);
  const attendance = fields.expectedAttendance.trim();

  return {
    name: fields.name,
    purpose: optional(fields.purpose),
    description: optional(fields.description),
    proposedStartAt: instant(fields.proposedStartAt),
    proposedEndAt: instant(fields.proposedEndAt),
    expectedAttendance: attendance.length > 0 ? Number(attendance) : undefined,
    accessibilityNeeds: optional(fields.accessibilityNeeds),
    equipmentRequired: fields.equipmentRequired,
    registrationRequired: fields.registrationRequired,
    registrationOpensAt: instant(fields.registrationOpensAt),
    registrationClosesAt: instant(fields.registrationClosesAt),
    venueRequirements: toVenueRequirements(fields),
    equipmentRequirements: fields.equipmentRequired ? toEquipmentLines(fields) : null,
  };
}

function toVenueRequirements(fields: RequestFields): VenueRequirements | null {
  const layout = fields.venueLayout.trim();
  const notes = fields.venueNotes.trim();
  const facilities = fields.venueFacilities
    .split(",")
    .map((facility) => facility.trim())
    .filter((facility) => facility.length > 0);

  if (!layout && !notes && facilities.length === 0) return null;
  return { layout: layout || null, facilities, notes: notes || null };
}

/**
 * A line with anything in it is sent, even if incomplete, so the server can say
 * what is wrong with it; only lines left entirely blank are dropped.
 */
function toEquipmentLines(fields: RequestFields): EquipmentRequirementLine[] | null {
  const lines = fields.equipmentLines
    .filter((line) => line.equipmentType.trim() || line.quantity.trim() || line.notes.trim())
    .map((line) => ({
      equipmentType: line.equipmentType,
      quantity: Number(line.quantity),
      notes: line.notes.trim() || null,
    }));
  return lines.length > 0 ? lines : null;
}

export function toFormFields(event: EventRecord): RequestFields {
  const local = (value: string | null) => {
    if (!value) return "";
    const date = new Date(value);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
      date.getHours()
    )}:${pad(date.getMinutes())}`;
  };

  return {
    name: event.name ?? "",
    purpose: event.purpose ?? "",
    description: event.description ?? "",
    proposedStartAt: local(event.proposedStartAt),
    proposedEndAt: local(event.proposedEndAt),
    expectedAttendance: event.expectedAttendance === null ? "" : String(event.expectedAttendance),
    accessibilityNeeds: event.accessibilityNeeds ?? "",
    equipmentRequired: event.equipmentRequired ?? false,
    registrationRequired: event.registrationRequired ?? false,
    registrationOpensAt: local(event.registrationOpensAt),
    registrationClosesAt: local(event.registrationClosesAt),
    venueLayout: event.venueRequirements?.layout ?? "",
    venueFacilities: (event.venueRequirements?.facilities ?? []).join(", "),
    venueNotes: event.venueRequirements?.notes ?? "",
    equipmentLines: (event.equipmentRequirements ?? []).map((line) => ({
      equipmentType: line.equipmentType,
      quantity: String(line.quantity),
      notes: line.notes ?? "",
    })),
  };
}

/** C3 — the caller's requests, drafts and submitted alike. */
export function listRequests(token: string, kind?: "drafts" | "submitted") {
  const query = kind ? `?kind=${kind}` : "";
  return request<Paged<EventListItem>>(`${EVENT}/events${query}`, { token });
}

/** D1 — the review queue. */
export function listQueue(token: string) {
  return request<Paged<EventRecord>>(`${EVENT}/events/queue`, { token });
}

/** D1 — opening a Submitted request claims it for review. */
export function openEvent(token: string, id: string) {
  return request<EventRecord>(`${EVENT}/events/${id}`, { token });
}

/** C1 */
export function saveDraft(token: string, fields: RequestFields) {
  return request<EventRecord>(`${EVENT}/event-drafts`, {
    method: "POST",
    token,
    body: toRequestBody(fields, { partial: true }),
  });
}

/** C2 */
export function updateDraft(token: string, id: string, fields: RequestFields) {
  return request<EventRecord>(`${EVENT}/event-drafts/${id}`, {
    method: "PUT",
    token,
    body: toRequestBody(fields, { partial: true }),
  });
}

export function getDraft(token: string, id: string) {
  return request<EventRecord>(`${EVENT}/event-drafts/${id}`, { token });
}

/**
 * C2 — submits a draft with the values currently on screen. The server
 * validates them and stores them only if the submission succeeds, so a blocked
 * submission leaves the saved draft exactly as it was (B2).
 */
export function submitDraft(token: string, id: string, fields: RequestFields) {
  return request<EventRecord>(`${EVENT}/event-drafts/${id}/submit`, {
    method: "POST",
    token,
    body: toRequestBody(fields, { partial: true }),
  });
}

/** B1 — a request submitted without being saved as a draft first. */
export function submitDirect(token: string, fields: RequestFields) {
  return request<EventRecord>(`${EVENT}/events`, {
    method: "POST",
    token,
    body: toRequestBody(fields, { partial: false }),
  });
}

export function listClarifications(token: string, eventId: string) {
  return request<Paged<Clarification>>(`${EVENT}/events/${eventId}/clarifications`, { token });
}

/** D2 */
export function requestClarification(token: string, eventId: string, message: string) {
  return request<Clarification>(`${EVENT}/events/${eventId}/clarifications`, {
    method: "POST",
    token,
    body: { message },
  });
}

/** D3 — a reply, an amendment, or both. */
export function respondToClarification(
  token: string,
  eventId: string,
  body: { message?: string; amendments?: Record<string, unknown> }
) {
  return request<{ clarification: Clarification; event: EventRecord }>(
    `${EVENT}/events/${eventId}/clarifications/respond`,
    { method: "POST", token, body }
  );
}

/** D4 */
export function approveEvent(token: string, eventId: string) {
  return request<EventRecord>(`${EVENT}/events/${eventId}/approve`, { method: "POST", token });
}

/** D5 */
export function rejectEvent(token: string, eventId: string, reason: string) {
  return request<EventRecord>(`${EVENT}/events/${eventId}/reject`, {
    method: "POST",
    token,
    body: { reason },
  });
}
