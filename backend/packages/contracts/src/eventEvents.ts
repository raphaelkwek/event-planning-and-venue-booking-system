import { z } from "zod";
import { envelopeSchema } from "./envelope.js";
import { eventStatusSchema } from "./eventStatus.js";

/**
 * Domain events produced by the Event Service. Topic names follow
 * implementation.md §3.1; each payload carries the IDs and changed values a
 * consumer needs, never a whole aggregate and never a token or user record.
 */

export const EVENT_TOPICS = {
  submitted: "connectsphere.event.submitted.v1",
  coordinatorAssigned: "connectsphere.event.coordinator-assigned.v1",
  clarificationRequested: "connectsphere.event.clarification-requested.v1",
  clarificationResponded: "connectsphere.event.clarification-responded.v1",
  approved: "connectsphere.event.approved.v1",
  rejected: "connectsphere.event.rejected.v1",
} as const;

export type EventTopic = (typeof EVENT_TOPICS)[keyof typeof EVENT_TOPICS];

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

/** Validators keyed by messageType, for producers and consumers alike. */
export const EVENT_PAYLOAD_SCHEMAS = {
  "event.submitted": eventSubmittedPayloadSchema,
  "event.coordinator-assigned": eventCoordinatorAssignedPayloadSchema,
  "event.clarification-requested": eventClarificationRequestedPayloadSchema,
  "event.clarification-responded": eventClarificationRespondedPayloadSchema,
  "event.approved": eventApprovedPayloadSchema,
  "event.rejected": eventRejectedPayloadSchema,
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
