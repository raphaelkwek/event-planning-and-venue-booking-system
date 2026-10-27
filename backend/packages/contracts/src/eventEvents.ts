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

export const eventSubmittedPayloadSchema = z.object({
  ...eventRef,
  ownerId: z.string().uuid(),
  proposedStartAt: z.string().datetime(),
  proposedEndAt: z.string().datetime(),
  submittedAt: z.string().datetime(),
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
  "event.status-changed": eventStatusChangedPayloadSchema,
  "event.schedule-changed": eventScheduleChangedPayloadSchema,
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
