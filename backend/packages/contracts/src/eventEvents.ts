import { z } from "zod";
import { envelopeSchema } from "./envelope.js";
import { eventStatusSchema } from "./eventStatus.js";

/**
 * Domain events produced by the event module. All of them are published to
 * the event aggregate's topic, `KAFKA_TOPICS.event` (ADR-0008, see
 * topics.ts); the message type, not the topic, says which one this is. Each
 * payload carries the IDs and changed values a consumer needs, never a whole
 * aggregate and never a token or user record.
 */

const eventRef = {
  eventId: z.string().uuid(),
  eventReference: z.string().min(1),
  eventName: z.string().min(1),
};

/**
 * B1, C2: a request was submitted, and (E3) entered the Lead's unassigned queue. Team decision
 * D-02 (clarifications.md, 4 Nov 2026): `leadIds` names every active Event Coordinator Lead at
 * submission, whom the notification service tells. Optional and additive: a message written
 * before D-02 names none and tells nobody.
 */
export const eventSubmittedPayloadSchema = z.object({
  ...eventRef,
  ownerId: z.string().uuid(),
  proposedStartAt: z.string().datetime(),
  proposedEndAt: z.string().datetime(),
  submittedAt: z.string().datetime(),
  leadIds: z.array(z.string().uuid()).optional(),
});

/**
 * E1 assigned on submission; since E3 the Lead assigns, and the message also
 * names the coordinator, the owner and the Lead, so the organiser is told who
 * their point of contact is. Messages written before E3 carry none of the three.
 */
export const eventCoordinatorAssignedPayloadSchema = z.object({
  ...eventRef,
  coordinatorId: z.string().uuid(),
  coordinatorName: z.string().min(1).optional(),
  ownerId: z.string().uuid().optional(),
  assignedBy: z.string().uuid().optional(),
  assignmentRule: z.string().min(1),
  assignedAt: z.string().datetime(),
});

/** E4: the Lead moved the event from one coordinator to another, at once. All three are told. */
export const eventCoordinatorReassignedPayloadSchema = z.object({
  ...eventRef,
  previousCoordinatorId: z.string().uuid(),
  coordinatorId: z.string().uuid(),
  coordinatorName: z.string().min(1),
  ownerId: z.string().uuid(),
  reassignedBy: z.string().uuid(),
  reassignedAt: z.string().datetime(),
});

export const eventClarificationRequestedPayloadSchema = z.object({
  ...eventRef,
  clarificationId: z.string().uuid(),
  ownerId: z.string().uuid(),
  requestedBy: z.string().uuid(),
  requestedAt: z.string().datetime(),
});

export const eventClarificationRespondedPayloadSchema = z.object({
  ...eventRef,
  clarificationId: z.string().uuid(),
  requestedBy: z.string().uuid(),
  respondedBy: z.string().uuid(),
  respondedAt: z.string().datetime(),
  amendedFields: z.array(z.string()),
});

export const eventApprovedPayloadSchema = z.object({
  ...eventRef,
  ownerId: z.string().uuid(),
  approvedBy: z.string().uuid(),
  approvedAt: z.string().datetime(),
});

export const eventRejectedPayloadSchema = z.object({
  ...eventRef,
  ownerId: z.string().uuid(),
  rejectedBy: z.string().uuid(),
  rejectedAt: z.string().datetime(),
  reason: z.string().min(1),
});

export const eventReassignmentProposedPayloadSchema = z.object({
  ...eventRef,
  proposalId: z.string().uuid(),
  outgoingCoordinatorId: z.string().uuid(),
  nomineeCoordinatorId: z.string().uuid(),
  proposedAt: z.string().datetime(),
});

/** Both parties are notified from one event, so both ids travel together. */
export const eventReassignmentAcceptedPayloadSchema = z.object({
  ...eventRef,
  proposalId: z.string().uuid(),
  outgoingCoordinatorId: z.string().uuid(),
  nomineeCoordinatorId: z.string().uuid(),
  resolvedAt: z.string().datetime(),
});

export const eventReassignmentDeclinedPayloadSchema = z.object({
  ...eventRef,
  proposalId: z.string().uuid(),
  outgoingCoordinatorId: z.string().uuid(),
  nomineeCoordinatorId: z.string().uuid(),
  resolvedAt: z.string().datetime(),
});

/**
 * F5 — the assigned coordinator confirmed the venue and equipment arrangements,
 * and the event moved to Safety Review (CR-06). It names everyone F5 notifies:
 * the owner, the Venue Staff of each confirmed booking's venue, and whoever
 * reserved each reservation. A venue with no staff has an empty `staffIds`; an
 * event marked as needing no equipment has no reservations.
 */
export const eventArrangementsConfirmedPayloadSchema = z.object({
  ...eventRef,
  ownerId: z.string().uuid(),
  confirmedBy: z.string().uuid(),
  confirmedAt: z.string().datetime(),
  bookings: z
    .array(
      z.object({
        bookingId: z.string().uuid(),
        reference: z.string().min(1),
        venueName: z.string().min(1),
        startsAt: z.string().datetime(),
        endsAt: z.string().datetime(),
        staffIds: z.array(z.string().uuid()),
      })
    )
    .min(1),
  reservations: z.array(
    z.object({
      reservationId: z.string().uuid(),
      equipmentTypeName: z.string().min(1),
      reservedQuantity: z.number().int().positive(),
      reservedBy: z.string().uuid(),
    })
  ),
  /**
   * D-02: every active Safety Officer when the event entered Safety Review, whose queue it is now
   * in (U1). Optional and additive: a message written before D-02 names none.
   */
  safetyOfficerIds: z.array(z.string().uuid()).optional(),
});

/** A hold released, or a pending booking request withdrawn, by a cancellation (F4, CQ-06), and its venue's staff. */
const releasedAtVenueSchema = z.object({
  reference: z.string().min(1),
  venueId: z.string().uuid(),
  venueName: z.string().min(1),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  staffIds: z.array(z.string().uuid()),
});

/**
 * U1 — the Safety Officer's decision on an event in Safety Review (CR-06). It names the owner and
 * the assigned coordinator, whom the decision notifies, and the arrangements a request for changes
 * flagged.
 */
export const eventSafetyDecisionRecordedPayloadSchema = z.object({
  ...eventRef,
  ownerId: z.string().uuid(),
  coordinatorId: z.string().uuid().nullable(),
  decision: z.enum(["APPROVE", "REQUEST_CHANGES", "REJECT"]),
  reason: z.string().nullable(),
  decidedBy: z.string().uuid(),
  decidedAt: z.string().datetime(),
  flaggedBookingReferences: z.array(z.string()),
  flaggedEquipment: z.array(z.string()),
});

/**
 * F3 — the event was cancelled, with its reason. It names everyone F3 notifies:
 * the owner, the assigned coordinator, the Venue Staff of each booked venue and
 * whoever reserved each reservation. Each booking and reservation listed was
 * released in the same transaction (F4). A cancelled draft has no
 * reference and nobody else to tell, so it writes no message.
 *
 * `holds` and `requests` (review note CQ-06 on F4, 3 Nov 2026) name the holds
 * released and the pending requests withdrawn, each with its venue and that
 * venue's staff, so they are told too. Both are optional and additive: a
 * message published before them still reads, and a consumer that doesn't need
 * them (registration's) ignores them.
 */
export const eventCancelledPayloadSchema = z.object({
  ...eventRef,
  ownerId: z.string().uuid(),
  assignedCoordinatorId: z.string().uuid().nullable(),
  reason: z.string().min(1),
  cancelledBy: z.string().uuid(),
  cancelledAt: z.string().datetime(),
  bookings: z.array(
    z.object({
      reference: z.string().min(1),
      venueName: z.string().min(1),
      startsAt: z.string().datetime(),
      endsAt: z.string().datetime(),
      staffIds: z.array(z.string().uuid()),
    })
  ),
  reservations: z.array(
    z.object({
      equipmentTypeName: z.string().min(1),
      reservedQuantity: z.number().int().positive(),
      reservedBy: z.string().uuid(),
    })
  ),
  holds: z.array(releasedAtVenueSchema).optional(),
  requests: z.array(releasedAtVenueSchema).optional(),
});

/**
 * EN-11 — every change of an event's status, whatever caused it. The event
 * module writes it in `transitionEvent`, the one path that changes a status,
 * so a consumer that cares about a status (the completion workflow cares about
 * CONFIRMED) needs no message per story. `action` is the row of F1's
 * transition table that moved it. The dates are the event's after the change,
 * so the completion workflow can set its timer without reading the event.
 */
export const eventStatusChangedPayloadSchema = z.object({
  eventId: z.string().uuid(),
  ownerId: z.string().uuid(),
  previousStatus: eventStatusSchema,
  newStatus: eventStatusSchema,
  action: z.string().regex(/^[A-Z][A-Z_]*$/),
  proposedStartAt: z.string().datetime().nullable(),
  proposedEndAt: z.string().datetime().nullable(),
  changedAt: z.string().datetime(),
});

/**
 * EN-11 — an approved event's date or times changed (S2 applies an approved
 * change). The completion workflow of a Confirmed event resets its timer to
 * the new end.
 */
export const eventScheduleChangedPayloadSchema = z.object({
  eventId: z.string().uuid(),
  ownerId: z.string().uuid(),
  status: eventStatusSchema,
  previousStartAt: z.string().datetime().nullable(),
  previousEndAt: z.string().datetime().nullable(),
  proposedStartAt: z.string().datetime().nullable(),
  proposedEndAt: z.string().datetime().nullable(),
  changedAt: z.string().datetime(),
});

/**
 * R1 to R4 — what an attendee may see of an event, and its registration
 * settings, as they stand after the change. The event module writes it in the
 * transaction of every change to any of these: each status change, an approved
 * change to the date or times (S2), an edit of the description (G1), and the
 * organiser's registration settings. The registration service keeps its own
 * copy from it, so it never reads the event schema (ADR-0005). A snapshot, so a
 * consumer applies the newest `changedAt` and ignores an older one. Only
 * published fields: no purpose, notes, comments or arrangements. A draft has no
 * reference and is never listed, so it writes none.
 */
export const eventListingChangedPayloadSchema = z.object({
  ...eventRef,
  ownerId: z.string().uuid(),
  /**
   * R5, R7: the event's assigned coordinator, who may see its registrations and
   * add attendees; null while none is assigned. Written since R5, also on each
   * change of coordinator (E2 to E4); a message written before then reads null.
   */
  assignedCoordinatorId: z.string().uuid().nullable().default(null),
  description: z.string().min(1).nullable(),
  status: eventStatusSchema,
  proposedStartAt: z.string().datetime().nullable(),
  proposedEndAt: z.string().datetime().nullable(),
  registrationRequired: z.boolean(),
  registrationOpensAt: z.string().datetime().nullable(),
  registrationClosesAt: z.string().datetime().nullable(),
  /** R4: null when the organiser set none, and withdrawal is then allowed until the event starts. */
  withdrawalDeadlineAt: z.string().datetime().nullable(),
  /**
   * EN-19: attendees of a high-demand event queue in the registration service's
   * waiting room and register with an admission token. A message published
   * before the flag existed reads as not high-demand.
   */
  highDemand: z.boolean().default(false),
  changedAt: z.string().datetime(),
});

/** Validators keyed by messageType, for producers and consumers alike. */
export const EVENT_PAYLOAD_SCHEMAS = {
  "event.submitted": eventSubmittedPayloadSchema,
  "event.coordinator-assigned": eventCoordinatorAssignedPayloadSchema,
  "event.coordinator-reassigned": eventCoordinatorReassignedPayloadSchema,
  "event.clarification-requested": eventClarificationRequestedPayloadSchema,
  "event.clarification-responded": eventClarificationRespondedPayloadSchema,
  "event.approved": eventApprovedPayloadSchema,
  "event.rejected": eventRejectedPayloadSchema,
  "event.reassignment-proposed": eventReassignmentProposedPayloadSchema,
  "event.reassignment-accepted": eventReassignmentAcceptedPayloadSchema,
  "event.reassignment-declined": eventReassignmentDeclinedPayloadSchema,
  "event.arrangements-confirmed": eventArrangementsConfirmedPayloadSchema,
  "event.safety-decision-recorded": eventSafetyDecisionRecordedPayloadSchema,
  "event.cancelled": eventCancelledPayloadSchema,
  "event.status-changed": eventStatusChangedPayloadSchema,
  "event.schedule-changed": eventScheduleChangedPayloadSchema,
  "event.listing-changed": eventListingChangedPayloadSchema,
} as const;

export type EventMessageType = keyof typeof EVENT_PAYLOAD_SCHEMAS;

/** Validates a whole message: the envelope, then the payload for its type. */
export function parseEventMessage(message: unknown) {
  const envelope = envelopeSchema.parse(message);
  const schema = EVENT_PAYLOAD_SCHEMAS[envelope.messageType as EventMessageType];
  if (!schema) {
    throw new Error(`Unknown event messageType: ${envelope.messageType}`);
  }
  return { ...envelope, payload: schema.parse(envelope.payload) };
}

export const eventStatusChangedSchema = z.object({
  previousStatus: eventStatusSchema,
  newStatus: eventStatusSchema,
});
