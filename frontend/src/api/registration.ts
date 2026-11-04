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

/** R2: the new registration, with the event's places remaining just after it, read live (D7). */
export interface RegistrationCreated extends RegistrationView {
  placesRemaining: number;
}

/** R2. `admissionToken` is the waiting room's, required for a high-demand event (EN-19). */
export function registerFor(token: string, eventId: string, admissionToken?: string | null) {
  return request<RegistrationCreated>(`${REGISTRATION}/registrations`, {
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

/** R6: a waitlist entry's status. */
export type WaitlistStatus = "WAITLISTED" | "REGISTERED" | "WITHDRAWN" | "CANCELLED";

interface EntryFields {
  id: string;
  reference: string;
  status: WaitlistStatus;
  /** Its place in the line while waiting; null once it has stopped. */
  position: number | null;
  joinedAt: string;
  lastNotifiedAt: string | null;
  registeredAt: string | null;
  withdrawnAt: string | null;
  cancelledAt: string | null;
}

/** R6: one of the attendee's own waitlist entries. */
export interface WaitlistEntryView extends EntryFields {
  event: { eventId: string; reference: string; name: string; startsAt: string | null; endsAt: string | null };
}

/** R6 */
export function joinWaitlist(token: string, eventId: string) {
  return request<WaitlistEntryView>(`${REGISTRATION}/events/${eventId}/waitlist`, { method: "POST", token });
}

/** R6 */
export function listMyWaitlist(token: string) {
  return request<Page<WaitlistEntryView>>(`${REGISTRATION}/waitlist-entries?limit=100`, { token });
}

/** R6 */
export function leaveWaitlist(token: string, entryId: string) {
  return request<WaitlistEntryView>(`${REGISTRATION}/waitlist-entries/${entryId}/withdrawal`, { method: "POST", token });
}

/** R5 to R7: a person on the organiser's lists, named by identity when the list was read. */
export interface Person {
  id: string;
  name: string | null;
  email: string | null;
}

/** R5, R7: one row of an event's registration list. */
export interface ManagedRegistration {
  id: string;
  reference: string;
  attendee: Person;
  status: RegistrationStatus;
  registeredAt: string;
  withdrawnAt: string | null;
  cancelledAt: string | null;
  manualAddition: { addedBy: Person; reason: string | null; overCapacity: boolean } | null;
  holdsSeat: boolean;
}

export interface ManagedEvent {
  eventId: string;
  reference: string;
  name: string;
  status: string;
  startsAt: string | null;
}

export interface RegistrationTotals {
  registered: number;
  withdrawn: number;
  cancelled: number;
  manuallyAdded: number;
  addedOverCapacity: number;
  capacity: number;
  placesRemaining: number;
  overCapacityBy: number;
}

export interface EventRegistrations {
  event: ManagedEvent;
  totals: RegistrationTotals;
  waitlist: { waiting: number };
  items: ManagedRegistration[];
  nextCursor: string | null;
  namesAvailable: boolean;
}

/** R5 */
export function listEventRegistrations(token: string, eventId: string, cursor?: string | null) {
  return request<EventRegistrations>(`${REGISTRATION}/events/${eventId}/registrations${pageQuery(cursor)}`, { token });
}

/** R6: one row of the organiser's view of the waitlist. */
export interface ManagedWaitlistEntry extends EntryFields {
  attendee: Person;
}

export interface EventWaitlist {
  event: ManagedEvent;
  waiting: number;
  items: ManagedWaitlistEntry[];
  nextCursor: string | null;
  namesAvailable: boolean;
}

/** R6 */
export function listEventWaitlist(token: string, eventId: string, cursor?: string | null) {
  return request<EventWaitlist>(`${REGISTRATION}/events/${eventId}/waitlist${pageQuery(cursor)}`, { token });
}

/** R7: an addition, refused with REGISTRATION_OVER_CAPACITY_UNCONFIRMED above capacity until it is confirmed. */
export function addAttendee(token: string, eventId: string, body: { attendeeEmail: string; reason: string | null; confirmOverCapacity: boolean }) {
  return request<ManagedRegistration & { capacity: number; totalAfter: number }>(`${REGISTRATION}/events/${eventId}/manual-registrations`, {
    method: "POST",
    token,
    body,
  });
}
