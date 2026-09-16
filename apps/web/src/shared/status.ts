import type { EventStatus } from "../api/types.js";

/**
 * implementation.md §7.1: the status colour map is defined once, here, and a
 * colour is never inlined at a call site.
 */
type LozengeAppearance = "default" | "inprogress" | "moved" | "new" | "removed" | "success";

export const STATUS_LABELS: Record<EventStatus, string> = {
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

export const STATUS_APPEARANCE: Record<EventStatus, LozengeAppearance> = {
  DRAFT: "default",
  SUBMITTED: "new",
  UNDER_REVIEW: "inprogress",
  AWAITING_CLARIFICATION: "moved",
  APPROVED: "success",
  PLANNING: "inprogress",
  CONFIRMED: "success",
  COMPLETED: "success",
  CANCELLED: "removed",
  REJECTED: "removed",
};

export function formatInstant(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}
