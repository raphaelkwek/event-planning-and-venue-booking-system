import type { EventStatus } from "../api/types.js";
import type { SignificantField } from "../api/changeRequests.js";

/** Mirrors `SIGNIFICANT_FIELD_LABELS` in backend/packages/contracts. */
export const SIGNIFICANT_FIELD_LABELS: Record<SignificantField, string> = {
  proposedStartAt: "start",
  proposedEndAt: "end",
  expectedAttendance: "expected attendance",
  venueRequirements: "venue requirements",
  equipmentRequired: "whether equipment is required",
  equipmentRequirements: "equipment requirements",
};

/** S1: a change can be requested from Submitted until the event is Completed, Cancelled or Rejected. */
const CHANGEABLE: readonly EventStatus[] = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "AWAITING_CLARIFICATION",
  "APPROVED",
  "PLANNING",
  "SAFETY_REVIEW",
  "CONFIRMED",
];

export const isChangeable = (status: EventStatus) => CHANGEABLE.includes(status);
