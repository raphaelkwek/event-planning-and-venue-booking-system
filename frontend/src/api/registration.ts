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

/** R2 */
export function registerFor(token: string, eventId: string) {
  return request<RegistrationView>(`${REGISTRATION}/registrations`, { method: "POST", token, body: { eventId } });
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
