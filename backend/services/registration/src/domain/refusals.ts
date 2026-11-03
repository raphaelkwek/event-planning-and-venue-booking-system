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
