import type { EventStatus } from "../api/types.js";
import type { ArrangementFlag, SignificantField } from "../api/changeRequests.js";

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

/** S2: how a field's value reads in the approval confirmation. */
export function formatChangeValue(field: SignificantField, value: unknown): string {
  if (value === null || value === undefined || value === "") return "none";
  if (field === "proposedStartAt" || field === "proposedEndAt") return new Date(String(value)).toLocaleString();
  if (field === "equipmentRequired") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** S3: how each arrangement flag reads on the impact list and the Outstanding flags panel. */
export const FLAG_LABELS: Record<ArrangementFlag, string> = {
  REQUIRES_RECONFIRMATION: "Requires reconfirmation",
  UNSUITABLE: "Unsuitable",
  FLAGGED_FOR_REVIEW: "Flagged for review",
};
