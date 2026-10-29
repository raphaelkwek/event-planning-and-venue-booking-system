import {
  EQUIPMENT_LINE_STATUS_LABELS,
  SIGNIFICANT_FIELD_LABELS,
  UNAVAILABILITY_REASON_LABELS,
  type EquipmentRequestLineStatus,
  type SignificantEventField,
  type UnavailabilityReasonType,
} from "@connectsphere/contracts";

/**
 * T2's recipient rules (EN-04.3): who is told what, from the facts the message
 * itself carries. Each trigger is an acceptance criterion on the story that
 * raises it. Only users the message names in their role on the event are
 * notified, so nobody unrelated to the event ever is (T2 AC2).
 *
 * Pure: no database and no Kafka, so every rule is unit-tested.
 */

/** The parts of a validated CloudEvent the rules read. */
export interface NotifiableEvent {
  id: string;
  type: string;
  time: string;
  subject: string;
  data: Record<string, unknown>;
}

/** One notification to store, for one recipient (T2 AC1). */
export interface NewNotification {
  recipientUserId: string;
  notificationType: string;
  eventId: string;
  eventReference: string;
  /** A booking, reservation or registration reference, where one applies. */
  relatedReference: string | null;
  message: string;
}

type Rule = (data: Record<string, string>, event: string) => Array<[recipient: string, message: string]>;

/** O2: names the equipment line and its new status, with the reason or the substitute where there is one. */
function equipmentLineMessage(d: Record<string, unknown>, event: string): string {
  const status = EQUIPMENT_LINE_STATUS_LABELS[d.newStatus as EquipmentRequestLineStatus];
  const line = `${d.equipmentTypeName} × ${d.quantity}`;
  if (d.released === true) {
    return `The reservation of ${line} for ${event} was released. The line is now ${status}. Reason: ${d.reason}`;
  }
  const reserved = typeof d.reservedQuantity === "number" && typeof d.quantity === "number" && d.reservedQuantity < d.quantity;
  const partial = reserved ? ` (${d.reservedQuantity} of ${d.quantity} reserved)` : "";
  let text = `Technical Support updated equipment for ${event}: ${line} is now ${status}${partial}.`;
  if (d.reason) text += ` Reason: ${d.reason}`;
  if (d.substituteEquipmentTypeName) text += ` Substitute: ${d.substituteEquipmentTypeName} × ${d.substituteQuantity}.`;
  return text;
}

/** An instant in Singapore time, where the venues are: its day, "Wednesday 2 December 2026", and its time, "13:00". */
function singaporeParts(iso: string): { day: string; time: string } {
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Singapore",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const part = (type: string) => p.find((x) => x.type === type)!.value;
  return { day: `${part("weekday")} ${part("day")} ${part("month")} ${part("year")}`, time: `${part("hour")}:${part("minute")}` };
}

/** A period in Singapore time: one day, or both ends when it crosses midnight. */
function period(startsAt: string, endsAt: string): string {
  const start = singaporeParts(startsAt);
  const end = singaporeParts(endsAt);
  return start.day === end.day ? `${start.day}, ${start.time}–${end.time}` : `${start.day} ${start.time} to ${end.day} ${end.time}`;
}

/** An instant in Singapore time, formatted as `period()` formats a day and time: "Wednesday 2 December 2026, 16:00". */
function instant(iso: string): string {
  return period(iso, iso).split("–")[0]!;
}

/** L6: a hold's reminder or expiry notice; `ending` completes the sentence after the period. */
function holdNotice(d: Record<string, unknown>, event: string, verb: string, ending: string): string {
  return `Hold ${d.holdReference} on ${d.venueName} for ${event}, ${period(d.startsAt as string, d.endsAt as string)}, ${verb} on ${instant(d.expiresAt as string)}. ${ending}`;
}

/** M1, M2: the coordinator who requested the venue and the event's owner, once each. */
function requesterAndOwner(d: Record<string, string>, text: string): Array<[string, string]> {
  return [...new Set([d.coordinatorId!, d.ownerId!])].map((recipient) => [recipient, text]);
}

/** M2: the reason as a sentence, then any suggested alternative. */
function rejectionMessage(d: Record<string, unknown>, event: string): string {
  const reason = String(d.reason);
  let text = `Booking request ${d.reference} for ${d.venueName} was rejected: ${event}, ${period(d.startsAt as string, d.endsAt as string)}.`;
  text += /[.!?]$/.test(reason) ? ` Reason: ${reason}` : ` Reason: ${reason}.`;
  if (d.suggestion) text += ` Suggested alternative: ${d.suggestion}`;
  return text;
}

/** S1: names each changed field the way the organiser's form does. */
function joinLabels(fields: unknown): string {
  return (fields as SignificantEventField[]).map((field) => SIGNIFICANT_FIELD_LABELS[field] ?? field).join(", ");
}

/** I2: what a block disrupted, as the coordinator calls it. */
function disruptedThing(kind: string): string {
  return kind === "REQUEST" ? "booking request" : kind === "HOLD" ? "hold" : "booking";
}

function capitalised(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** The block's reason type and description, as "(Maintenance: Stage rigging inspection)". */
function blockReason(d: Record<string, string>): string {
  // The message was validated against its contract, which allows only CR-02's five reason types.
  const reason = UNAVAILABILITY_REASON_LABELS[d.reasonType as UnavailabilityReasonType];
  return `(${reason}: ${d.description})`;
}

/** I5: a block with no end carries a null end, and lasts until Venue Staff remove it. The contract requires the field. */
function hasNoEnd(d: Record<string, string>): boolean {
  return d.blockEndsAt === null;
}

/** The day and time of an instant in Singapore time, as "Wednesday 2 December 2026, 13:00". */
function startOf(iso: string): string {
  const { day, time } = singaporeParts(iso);
  return `${day}, ${time}`;
}

/** I2: the block's period in Singapore time, with its reason type and description. */
function blockPeriodAndReason(d: Record<string, string>): string {
  return `${period(d.blockStartsAt!, d.blockEndsAt!)} ${blockReason(d)}`;
}

/** I2, I5: what the venue's unavailability is, for the disruption message. */
function blockedPeriod(d: Record<string, string>): string {
  return hasNoEnd(d)
    ? `${d.venueName} is unavailable from ${startOf(d.blockStartsAt!)} until Venue Staff lift it ${blockReason(d)}`
    : `${d.venueName} is unavailable on ${blockPeriodAndReason(d)}`;
}

/** I2, I5: which unavailability was removed, for the cleared message. */
function removedBlock(d: Record<string, string>): string {
  return hasNoEnd(d)
    ? `The open-ended unavailability of ${d.venueName} from ${startOf(d.blockStartsAt!)} ${blockReason(d)} was removed.`
    : `The unavailability of ${d.venueName} on ${blockPeriodAndReason(d)} was removed.`;
}

const RULES: Record<string, Rule> = {
  // B1 asks for the coordinator assigned on submission to hear that a request
  // awaits review. event.submitted does not name that coordinator; this
  // message, written in the same transaction, does (E1).
  "event.coordinator-assigned": (d, event) => [
    [d.coordinatorId!, `Event request ${event} has been assigned to you and is awaiting your review.`],
  ],
  "event.clarification-requested": (d, event) => [
    [d.ownerId!, `Clarification is required on your event request ${event}.`],
  ],
  "event.clarification-responded": (d, event) => [
    [d.requestedBy!, `The organiser has responded to your clarification request on ${event}.`],
  ],
  "event.approved": (d, event) => [[d.ownerId!, `Your event request ${event} has been approved.`]],
  "event.rejected": (d, event) => [[d.ownerId!, `Your event request ${event} has been rejected. Reason: ${d.reason}`]],
  "event.reassignment-proposed": (d, event) => [
    [d.nomineeCoordinatorId!, `You have been nominated to take over as coordinator of ${event}. Accept or decline the proposal.`],
  ],
  "event.reassignment-accepted": (d, event) => [
    [d.nomineeCoordinatorId!, `You are now the coordinator of ${event}.`],
    [d.outgoingCoordinatorId!, `Your reassignment of ${event} was accepted. You are no longer its coordinator.`],
  ],
  "event.reassignment-declined": (d, event) => [
    [d.outgoingCoordinatorId!, `Your proposal to reassign ${event} was declined. You remain its coordinator.`],
  ],
  // O2: the event's assigned coordinator learns what Technical Support decided about a line.
  "equipment-request.line-status-changed": (d, event) => [[d.coordinatorId!, equipmentLineMessage(d, event)]],
  // L1: the venue's Venue Staff learn a request is waiting for them. The message names them.
  "venue-booking.request-submitted": (d, event) =>
    (d.staffIds as unknown as string[]).map((staffId) => [
      staffId,
      `Booking request ${d.reference} was submitted for ${d.venueName}: ${event}, ${period(d.startsAt!, d.endsAt!)}. It is waiting in your Booking requests queue.`,
    ]),
  // M1: the requesting coordinator and the owner learn the booking is confirmed.
  "venue-booking.request-approved": (d, event) =>
    requesterAndOwner(
      d,
      `Booking request ${d.reference} was approved, and the booking is confirmed: ${d.venueName} for ${event}, ${period(d.startsAt!, d.endsAt!)}.`,
    ),
  // M2: they learn it was rejected, why, and any alternative suggested.
  "venue-booking.request-rejected": (d, event) => requesterAndOwner(d, rejectionMessage(d, event)),
  // I2, CR-02: a block disrupts the coordinator's booking, hold or request; alternative arrangements are required.
  "venue-booking.booking-disrupted": (d, event) => [
    [
      d.coordinatorId!,
      `${blockedPeriod(d)}, which disrupts ${disruptedThing(d.kind!)} ${d.reference} for ${event}. ` +
        `The ${d.kind === "REQUEST" ? "request" : d.kind === "HOLD" ? "hold" : "booking"} requires reconfirmation, and alternative arrangements are required.`,
    ],
  ],
  // I2: the block was removed; the flag clears unless other unavailability, or H3-T14 the venue's
  // times, still make it overlap. Messages written before H3-T14 carry no stillCause: unavailability.
  "venue-booking.disruption-cleared": (d, event) => {
    const thing = `${capitalised(disruptedThing(d.kind!))} ${d.reference} for ${event}`;
    const outcome = !(d.stillDisrupted as unknown as boolean)
      ? `${thing} no longer requires reconfirmation.`
      : d.stillCause === "BUFFER_CONFLICT"
        ? `${thing} still requires reconfirmation: with the venue's setup and turnaround time it still overlaps another booking, hold or request.`
        : `${thing} still requires reconfirmation: other unavailability still overlaps it.`;
    return [[d.coordinatorId!, `${removedBlock(d)} ${outcome}`]];
  },
  // L6: the holding coordinator is reminded before the hold expires, and told when it has.
  // hold-placed and hold-expiry-changed have no rule: they only drive the expiry workflow.
  "venue-booking.hold-expiring": (d, event) => [
    [d.coordinatorId!, holdNotice(d, event, "expires", "Convert it to a booking request or ask Venue Staff to extend it.")],
  ],
  "venue-booking.hold-expired": (d, event) => [
    [d.coordinatorId!, holdNotice(d, event, "expired", "The period is free for others.")],
  ],
  // H3-T10, H3-T11, CR-01: the venue's new setup or turnaround time makes the coordinator's booking,
  // hold or pending request overlap others. It is flagged for reconfirmation and nothing else changes.
  "venue-booking.buffer-conflict-flagged": (d, event) => {
    const overlaps = (d.overlapsReferences as unknown as string[]).join(" and ");
    const thing = disruptedThing(d.kind!);
    const short = d.kind === "REQUEST" ? "request" : thing;
    return [
      [
        d.coordinatorId!,
        `${d.venueName} now needs ${d.setupMinutes} minutes of setup and ${d.turnaroundMinutes} minutes of turnaround, ` +
          `so ${thing} ${d.reference} for ${event} now overlaps ${overlaps}. The ${short} requires reconfirmation. ` +
          "It has not been removed, released or moved.",
      ],
    ];
  },
  // S1: the assigned coordinator hears that the organiser asked to change the event.
  "change-request.submitted": (d, event) => [
    [d.coordinatorId!, `A change has been requested for ${event}: ${joinLabels(d.fields)}.`],
  ],
  // S2: the organiser hears what the coordinator decided about their request.
  "change-request.approved": (d, event) => [
    [d.ownerId!, `Your change request for ${event} was approved: ${joinLabels(d.fields)}.`],
  ],
  "change-request.rejected": (d, event) => [
    [d.ownerId!, `Your change request for ${event} was rejected. Reason: ${d.reason}`],
  ],
  // F5: the owner, the Venue Staff of each booked venue (once per booking), and each Technical
  // Support Staff member who reserved equipment (once, listing what they reserved).
  "event.arrangements-confirmed": (d, event) => arrangementsConfirmed(d as unknown as ArrangementsConfirmed, event),
  "event.cancelled": (d, event) => eventCancelled(d as unknown as EventCancelled, event),
};

/** F5's message data, as its contract (`eventArrangementsConfirmedPayloadSchema`) validated it. */
interface ArrangementsConfirmed {
  ownerId: string;
  bookings: { reference: string; venueName: string; startsAt: string; endsAt: string; staffIds: string[] }[];
  reservations: { equipmentTypeName: string; reservedQuantity: number; reservedBy: string }[];
}

function arrangementsConfirmed(d: ArrangementsConfirmed, event: string): Array<[string, string]> {
  const inReview = "It is now in Safety Review.";
  const notices: Array<[string, string]> = [
    [d.ownerId, `Your event ${event} has its venue and equipment arrangements confirmed. It is now in Safety Review, awaiting the Safety Officer.`],
  ];
  for (const booking of d.bookings) {
    const text = `${event} has confirmed its arrangements, including booking ${booking.reference} at ${booking.venueName}, ${period(booking.startsAt, booking.endsAt)}. ${inReview}`;
    for (const staffId of booking.staffIds) notices.push([staffId, text]);
  }
  const reservers = [...new Set(d.reservations.map((reservation) => reservation.reservedBy))];
  for (const reserver of reservers) {
    const reserved = d.reservations
      .filter((reservation) => reservation.reservedBy === reserver)
      .map((reservation) => `${reservation.equipmentTypeName} × ${reservation.reservedQuantity}`)
      .join(", ");
    notices.push([reserver, `${event} has confirmed its arrangements, including the equipment you reserved: ${reserved}. ${inReview}`]);
  }
  return notices;
}

/** F3's message data, as its contract (`eventCancelledPayloadSchema`) validated it. */
interface EventCancelled {
  ownerId: string;
  assignedCoordinatorId: string | null;
  reason: string;
  bookings: { reference: string; venueName: string; startsAt: string; endsAt: string; staffIds: string[] }[];
  reservations: { equipmentTypeName: string; reservedQuantity: number; reservedBy: string }[];
}

/**
 * F3 AC6 — the owner, the assigned coordinator, the Venue Staff of each booked venue and whoever reserved
 * each reservation, each told once about all of theirs. Someone with two roles on the event gets the first
 * notice that names them.
 */
function eventCancelled(d: EventCancelled, event: string): Array<[string, string]> {
  const cancelled = `${event} has been cancelled. Reason: ${d.reason}`;
  const notices = new Map<string, string>();
  const tell = (recipient: string, text: string) => {
    if (!notices.has(recipient)) notices.set(recipient, text);
  };
  tell(d.ownerId, `Your event ${cancelled}`);
  if (d.assignedCoordinatorId) tell(d.assignedCoordinatorId, `The event ${cancelled}`);
  const staff = [...new Set(d.bookings.flatMap((booking) => booking.staffIds))];
  for (const staffId of staff) {
    const booked = d.bookings
      .filter((booking) => booking.staffIds.includes(staffId))
      .map((booking) => `booking ${booking.reference} at ${booking.venueName}, ${period(booking.startsAt, booking.endsAt)}`)
      .join("; ");
    tell(staffId, `${cancelled} It had ${booked}.`);
  }
  const reservers = [...new Set(d.reservations.map((reservation) => reservation.reservedBy))];
  for (const reserver of reservers) {
    const reserved = d.reservations
      .filter((reservation) => reservation.reservedBy === reserver)
      .map((reservation) => `${reservation.equipmentTypeName} × ${reservation.reservedQuantity}`)
      .join(", ");
    tell(reserver, `${cancelled} It had the equipment you reserved: ${reserved}.`);
  }
  return [...notices];
}

/** The notifications a message raises; none for a type no story asks to notify about. */
export function notificationsFor(message: NotifiableEvent): NewNotification[] {
  const rule = RULES[message.type];
  if (!rule) return [];
  const data = message.data as Record<string, string>;
  const event = `${data.eventReference} “${data.eventName}”`;
  return rule(data, event).map(([recipientUserId, text]) => ({
    recipientUserId,
    notificationType: message.type,
    eventId: data.eventId!,
    eventReference: data.eventReference!,
    // A booking request's own reference, or a hold's, for the venue-booking messages (L1, L6).
    relatedReference: message.type.startsWith("venue-booking.") ? (data.reference ?? data.holdReference!) : null,
    message: text,
  }));
}
