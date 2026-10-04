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
    relatedReference: null,
    message: text,
  }));
}
