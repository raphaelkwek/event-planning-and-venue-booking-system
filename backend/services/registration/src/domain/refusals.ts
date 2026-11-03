import { REGISTRATION_STATUS_LABELS, type RegistrationStatus } from "@connectsphere/contracts";
import type { WindowState } from "./registrationRules.js";

/**
 * R2, R4 — what an attendee is told when the service refuses, naming the cause
 * as each story requires: capacity, the existing registration, the window, the
 * deadline. Times are in Singapore, where the events are. Pure.
 */

/** An event as the attendee knows it: `EVT-000123 “Annual Research Symposium”`. */
export interface EventLabel {
  reference: string;
  name: string;
}

export function eventLabel(event: EventLabel): string {
  return `${event.reference} “${event.name}”`;
}

/** An instant in Singapore time: "Tuesday 1 December 2026, 09:00". */
export function singaporeMoment(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Singapore",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part("weekday")} ${part("day")} ${part("month")} ${part("year")}, ${part("hour")}:${part("minute")}`;
}

/** R2: refused for capacity, offering the waitlist (R6). */
export function capacityMessage(event: EventLabel): string {
  return `${eventLabel(event)} has no places remaining, so you were not registered. You can ask for a place on the waitlist instead.`;
}

/** R2: a second registration names the first. */
export function duplicateMessage(event: EventLabel, registrationReference: string): string {
  return `You are already registered for ${eventLabel(event)} (registration ${registrationReference}), so no second registration was made.`;
}

/** R2: outside the window, naming it. */
export function windowMessage(event: EventLabel, state: Exclude<WindowState, "OPEN">, opensAt: string | null, closesAt: string | null): string {
  if (opensAt === null || closesAt === null) return `Registration for ${eventLabel(event)} is not open, so you cannot register.`;
  const opens = singaporeMoment(opensAt);
  const closes = singaporeMoment(closesAt);
  return state === "NOT_YET_OPEN"
    ? `Registration for ${eventLabel(event)} opens on ${opens} and closes on ${closes}, so you cannot register now.`
    : `Registration for ${eventLabel(event)} opened on ${opens} and closed on ${closes}, so you can no longer register.`;
}

/** R4: after the deadline, naming it; where the organiser set none, the deadline was the event's start. */
export function deadlineMessage(event: EventLabel, registrationReference: string, deadline: { at: string; isEventStart: boolean }): string {
  const when = deadline.isEventStart ? `its start, ${singaporeMoment(deadline.at)}` : singaporeMoment(deadline.at);
  return `The withdrawal deadline for ${eventLabel(event)} was ${when}, so registration ${registrationReference} can no longer be withdrawn.`;
}

/** R4: only a Registered registration can be withdrawn. */
export function notActiveMessage(registrationReference: string, status: RegistrationStatus): string {
  return `Registration ${registrationReference} is ${REGISTRATION_STATUS_LABELS[status]}, so it cannot be withdrawn.`;
}

/** EN-19: a flagged event takes registrations only from an attendee the waiting room has admitted. */
export function admissionRequiredMessage(event: EventLabel): string {
  return `${eventLabel(event)} is a high-demand event, so you must join its waiting room and be admitted before you can register. Nothing was changed.`;
}

/** EN-19: the admission was good once, and its time is up. */
export function admissionExpiredMessage(event: EventLabel): string {
  return `Your turn to register for ${eventLabel(event)} has passed. Join the waiting room again for a new place in the queue. Nothing was changed.`;
}

/** EN-19: there is no queue for an event that is not high-demand. */
export function waitingRoomNotRequiredMessage(event: EventLabel): string {
  return `${eventLabel(event)} is not a high-demand event, so it has no waiting room. You can register for it directly.`;
}

/** "1 place" or "3 places". */
function places(n: number): string {
  return n === 1 ? "1 place" : `${n} places`;
}

/** R6: places remain, so the attendee should register instead. */
export function waitlistPlacesMessage(event: EventLabel, placesRemaining: number): string {
  return `${eventLabel(event)} still has ${places(placesRemaining)} remaining, so register instead of joining the waitlist.`;
}

/** R6: a second waiting entry names the first. */
export function waitlistDuplicateMessage(event: EventLabel, entryReference: string): string {
  return `You are already on the waitlist for ${eventLabel(event)} (${entryReference}), so no second entry was made.`;
}

/** R6: an attendee holding a registration can't also wait for one. */
export function waitlistRegisteredMessage(event: EventLabel, registrationReference: string): string {
  return `You are already registered for ${eventLabel(event)} (registration ${registrationReference}), so you can't also join its waitlist.`;
}

/** R6: only a waiting entry can be left; the message says what became of it. */
export function waitlistNotActiveMessage(entryReference: string, status: "REGISTERED" | "WITHDRAWN" | "CANCELLED"): string {
  const what = { REGISTERED: "ended when you registered", WITHDRAWN: "was already left", CANCELLED: "was cancelled with the event" }[status];
  return `Waitlist entry ${entryReference} ${what}, so there is nothing to leave.`;
}

/** R7: nobody with that email can be added. */
export function attendeeNotFoundMessage(email: string): string {
  return `No attendee account has the email ${email}, so nobody was added. Only someone who signs in as an attendee can be added.`;
}

/** R7: without a confirmed booking there is no capacity yet. */
export function noBookingMessage(event: EventLabel): string {
  return `${eventLabel(event)} has no confirmed venue booking, so its capacity is not known yet and nobody can be added.`;
}

/** R7 (D-01): over capacity, the organiser confirms first. */
export function overCapacityMessage(event: EventLabel, capacity: number, totalAfter: number): string {
  return `${eventLabel(event)} has a capacity of ${capacity}. Adding this attendee makes ${totalAfter}, above capacity, so they were not added. Confirm to add them anyway.`;
}

/** R7: a cancelled, rejected or completed event takes nobody. */
export function eventClosedMessage(event: EventLabel, statusLabel: string): string {
  return `${eventLabel(event)} is ${statusLabel}, so nobody can be added to it.`;
}

/** R7: the attendee already holds a registration, which the refusal names. */
export function additionDuplicateMessage(event: EventLabel, email: string, registrationReference: string): string {
  return `${email} already holds registration ${registrationReference} for ${eventLabel(event)}, so they were not added again.`;
}
