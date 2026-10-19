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

export const eventCoordinatorAssignedPayloadSchema = z.object({
  ...eventRef,
  coordinatorId: z.string().uuid(),
  assignmentRule: z.string().min(1),
  assignedAt: z.string().datetime(),
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

/** Validators keyed by messageType, for producers and consumers alike. */
export const EVENT_PAYLOAD_SCHEMAS = {
  "event.submitted": eventSubmittedPayloadSchema,
  "event.coordinator-assigned": eventCoordinatorAssignedPayloadSchema,
  "event.clarification-requested": eventClarificationRequestedPayloadSchema,
  "event.clarification-responded": eventClarificationRespondedPayloadSchema,
  "event.approved": eventApprovedPayloadSchema,
  "event.rejected": eventRejectedPayloadSchema,
  "event.reassignment-proposed": eventReassignmentProposedPayloadSchema,
  "event.reassignment-accepted": eventReassignmentAcceptedPayloadSchema,
  "event.reassignment-declined": eventReassignmentDeclinedPayloadSchema,
  "event.arrangements-confirmed": eventArrangementsConfirmedPayloadSchema,
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
