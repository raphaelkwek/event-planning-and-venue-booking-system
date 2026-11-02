import { request } from "./client.js";
import type { EventRecord } from "./types.js";

/**
 * R1 to R4: the attendee API, served by the registration service (ADR-0005)
 * through the dev server's /registration proxy. R2 and R4's organiser settings
 * are planning-core's, through /event.
 */

const REGISTRATION = "/registration/api/v1";
const EVENT = "/event/api/v1";

export interface PublicVenue {
  name: string;
  location: string | null;
}

export interface OpenEvent {
  eventId: string;
  reference: string;
  name: string;
  description: string | null;
  startsAt: string | null;
  endsAt: string | null;
  venues: PublicVenue[];
  registrationOpensAt: string | null;
  registrationClosesAt: string | null;
  withdrawalDeadline: string | null;
  placesRemaining: number;
  isFull: boolean;
  /** EN-19: attendees queue in the waiting room and register with an admission token. */
  highDemand: boolean;
}

export type RegistrationStatus = "REGISTERED" | "WITHDRAWN" | "CANCELLED";

export interface RegistrationView {
  id: string;
  reference: string;
  status: RegistrationStatus;
  registeredAt: string;
  withdrawnAt: string | null;
  cancelledAt: string | null;
  event: {
    eventId: string;
    reference: string;
    name: string;
    startsAt: string | null;
    endsAt: string | null;
    venues: PublicVenue[];
    withdrawalDeadline: string | null;
  };
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

const pageQuery = (cursor?: string | null) => (cursor ? `?cursor=${encodeURIComponent(cursor)}` : "");

/** R1 */
export function listOpenEvents(token: string, cursor?: string | null) {
  return request<Page<OpenEvent>>(`${REGISTRATION}/open-events${pageQuery(cursor)}`, { token });
}

/** R1, R2 */
export function getOpenEvent(token: string, eventId: string) {
  return request<OpenEvent>(`${REGISTRATION}/open-events/${eventId}`, { token });
}

/** R2. `admissionToken` is the waiting room's, required for a high-demand event (EN-19). */
export function registerFor(token: string, eventId: string, admissionToken?: string | null) {
  return request<RegistrationView>(`${REGISTRATION}/registrations`, {
    method: "POST",
    token,
    body: { eventId },
    ...(admissionToken ? { headers: { "X-Admission-Token": admissionToken } } : {}),
  });
}

export type WaitingRoomStatus = "WAITING" | "ADMITTED" | "EXPIRED" | "USED";

/** EN-19: an attendee's place in a high-demand event's waiting room. */
export interface WaitingRoomPlace {
  entryId: string;
  eventId: string;
  status: WaitingRoomStatus;
  /** 1 for the next to be admitted; 0 once no longer waiting. */
  position: number;
  estimatedWaitSeconds: number;
  admitAt: string;
  expiresAt: string;
  /** Present only while ADMITTED: sent as X-Admission-Token to register. */
  admissionToken: string | null;
}

/** EN-19: join the queue (or get the place already held). */
export function joinWaitingRoom(token: string, eventId: string) {
  return request<WaitingRoomPlace>(`${REGISTRATION}/waiting-room/entries`, { method: "POST", token, body: { eventId } });
}

/** EN-19: where a place stands; poll it until ADMITTED. */
export function getWaitingRoomPlace(token: string, entryId: string) {
  return request<WaitingRoomPlace>(`${REGISTRATION}/waiting-room/entries/${entryId}`, { token });
}

/** R3 */
export function listMyRegistrations(token: string, cursor?: string | null) {
  return request<Page<RegistrationView>>(`${REGISTRATION}/registrations${pageQuery(cursor)}`, { token });
}

/** R4 */
export function withdrawRegistration(token: string, registrationId: string) {
  return request<RegistrationView>(`${REGISTRATION}/registrations/${registrationId}/withdrawal`, { method: "POST", token });
}

export interface RegistrationSettings {
  registrationRequired: boolean;
  registrationOpensAt: string | null;
  registrationClosesAt: string | null;
  withdrawalDeadlineAt: string | null;
}

/** R2, R4: the owning organiser's settings, refused with 412 if the event changed since `version` was loaded. */
export function saveRegistrationSettings(token: string, eventId: string, version: number, settings: RegistrationSettings) {
  return request<EventRecord>(`${EVENT}/events/${eventId}/registration-settings`, {
    method: "PUT",
    token,
    body: settings,
    headers: { "If-Match": `"${version}"` },
  });
}

/** EN-19: the owning organiser flags the event high-demand, or takes the flag off; refused with 412 if the event changed since `version` was loaded. */
export function setHighDemand(token: string, eventId: string, version: number, highDemand: boolean) {
  return request<EventRecord>(`${EVENT}/events/${eventId}/high-demand`, {
    method: "PUT",
    token,
    body: { highDemand },
    headers: { "If-Match": `"${version}"` },
  });
}
