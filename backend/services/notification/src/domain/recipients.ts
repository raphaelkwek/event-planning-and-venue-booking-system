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

/** A period in Singapore time, where the venues are: one day, or both ends when it crosses midnight. */
function period(startsAt: string, endsAt: string): string {
  const parts = (iso: string) => {
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
  };
  const start = parts(startsAt);
  const end = parts(endsAt);
  return start.day === end.day ? `${start.day}, ${start.time}–${end.time}` : `${start.day} ${start.time} to ${end.day} ${end.time}`;
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

/** I2: the block's period in Singapore time, with its reason type and description. */
function blockPeriodAndReason(d: Record<string, string>): string {
  // The message was validated against its contract, which allows only CR-02's five reason types.
  const reason = UNAVAILABILITY_REASON_LABELS[d.reasonType as UnavailabilityReasonType];
  return `${period(d.blockStartsAt!, d.blockEndsAt!)} (${reason}: ${d.description})`;
}

function blockedPeriod(d: Record<string, string>): string {
  return `${d.venueName} is unavailable on ${blockPeriodAndReason(d)}`;
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
  // I2: the block was removed; the flag clears unless other unavailability still overlaps it.
  "venue-booking.disruption-cleared": (d, event) => {
    const thing = `${capitalised(disruptedThing(d.kind!))} ${d.reference} for ${event}`;
    const outcome = (d.stillDisrupted as unknown as boolean)
      ? `${thing} still requires reconfirmation: other unavailability still overlaps it.`
      : `${thing} no longer requires reconfirmation.`;
    return [[d.coordinatorId!, `The unavailability of ${d.venueName} on ${blockPeriodAndReason(d)} was removed. ${outcome}`]];
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
};

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
    // A booking request's own reference, for the venue-booking messages (L1).
    relatedReference: message.type.startsWith("venue-booking.") ? data.reference! : null,
    message: text,
  }));
}
