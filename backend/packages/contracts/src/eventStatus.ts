import { z } from "zod";

/**
 * The permitted event statuses (F1). This list is exhaustive and shared:
 * a service inventing a status outside it is a failed review.
 */
export const EVENT_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "AWAITING_CLARIFICATION",
  "APPROVED",
  "PLANNING",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
  "REJECTED",
] as const;

export type EventStatus = (typeof EVENT_STATUSES)[number];

export const eventStatusSchema = z.enum(EVENT_STATUSES);

/** Statuses that carry a recorded decision, so they cannot be decided again (D4, D5). */
export const DECIDED_STATUSES: readonly EventStatus[] = [
  "APPROVED",
  "PLANNING",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
  "REJECTED",
];

/** How a status reads to a user. The UI never invents its own wording. */
export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under Review",
  AWAITING_CLARIFICATION: "Awaiting Clarification",
  APPROVED: "Approved",
  PLANNING: "Planning",
  CONFIRMED: "Confirmed",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  REJECTED: "Rejected",
};
