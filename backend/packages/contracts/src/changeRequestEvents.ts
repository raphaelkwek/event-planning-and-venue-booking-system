import { z } from "zod";
import { SIGNIFICANT_EVENT_FIELDS } from "./eventFields.js";

/**
 * S1 — the change module's messages. They go on the event topic, keyed by the
 * event id, so every message about one event stays in order (S1 spec,
 * decision 3).
 */
export const changeRequestSubmittedPayloadSchema = z.object({
  eventId: z.string().uuid(),
  eventReference: z.string(),
  eventName: z.string(),
  coordinatorId: z.string().uuid(),
  changeRequestId: z.string().uuid(),
  fields: z.array(z.enum(SIGNIFICANT_EVENT_FIELDS)).min(1),
  requestedBy: z.string().uuid(),
  requestedAt: z.string().datetime(),
});

/** S2 — what a coordinator's decision tells the organiser; a rejection also carries the reason. */
const decided = {
  eventId: z.string().uuid(),
  eventReference: z.string(),
  eventName: z.string(),
  ownerId: z.string().uuid(),
  changeRequestId: z.string().uuid(),
  fields: z.array(z.enum(SIGNIFICANT_EVENT_FIELDS)).min(1),
  decidedBy: z.string().uuid(),
  decidedAt: z.string().datetime(),
};
export const changeRequestApprovedPayloadSchema = z.object(decided);
export const changeRequestRejectedPayloadSchema = z.object({ ...decided, reason: z.string().min(1) });

/**
 * S3 — an approved change flagged some of the event's arrangements (AC2–AC4).
 * One entry per flag: a booking can appear twice, once Requires Reconfirmation
 * and once Unsuitable. It carries who looks after each arrangement, the
 * venue's staff and the member of Technical Support who reserved it, so the
 * notification service tells them without reading another module (AC10).
 * Written only when something was flagged.
 */
export const changeRequestArrangementsFlaggedPayloadSchema = z
  .object({
    eventId: z.string().uuid(),
    eventReference: z.string(),
    eventName: z.string(),
    changeRequestId: z.string().uuid(),
    bookings: z.array(
      z.object({
        reference: z.string().min(1),
        venueName: z.string().min(1),
        flag: z.enum(["REQUIRES_RECONFIRMATION", "UNSUITABLE"]),
        reason: z.string().min(1),
        staffIds: z.array(z.string().uuid()),
      })
    ),
    reservations: z.array(
      z.object({
        equipmentTypeName: z.string().min(1),
        flag: z.literal("FLAGGED_FOR_REVIEW"),
        reason: z.string().min(1),
        reservedBy: z.string().uuid(),
      })
    ),
    /** The event was Confirmed and the change returned it to Planning (Week 9 W9-22). */
    returnedToPlanning: z.boolean(),
  })
  .refine((data) => data.bookings.length + data.reservations.length > 0, {
    message: "An arrangements-flagged message names at least one flag.",
  });

export const CHANGE_REQUEST_PAYLOAD_SCHEMAS = {
  "change-request.submitted": changeRequestSubmittedPayloadSchema,
  "change-request.approved": changeRequestApprovedPayloadSchema,
  "change-request.rejected": changeRequestRejectedPayloadSchema,
  "change-request.arrangements-flagged": changeRequestArrangementsFlaggedPayloadSchema,
} as const;

export type ChangeRequestArrangementsFlagged = z.infer<typeof changeRequestArrangementsFlaggedPayloadSchema>;

export type ChangeRequestMessageType = keyof typeof CHANGE_REQUEST_PAYLOAD_SCHEMAS;

/** How each significant field is named to people (form labels, notifications). */
export const SIGNIFICANT_FIELD_LABELS: Record<(typeof SIGNIFICANT_EVENT_FIELDS)[number], string> = {
  proposedStartAt: "start",
  proposedEndAt: "end",
  expectedAttendance: "expected attendance",
  venueRequirements: "venue requirements",
  equipmentRequired: "whether equipment is required",
  equipmentRequirements: "equipment requirements",
};
