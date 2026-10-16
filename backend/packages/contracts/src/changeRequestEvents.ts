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

export const CHANGE_REQUEST_PAYLOAD_SCHEMAS = {
  "change-request.submitted": changeRequestSubmittedPayloadSchema,
} as const;

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
