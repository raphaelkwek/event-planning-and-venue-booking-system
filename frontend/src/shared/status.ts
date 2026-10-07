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

/**
 * I1: the availability calendar's states. Pending is a different colour from
 * Confirmed (AC3), and setup and turnaround from the event they surround (AC5).
 */
export type CalendarState =
  | "CONFIRMED"
  | "PENDING"
  | "SETUP"
  | "TURNAROUND"
  | "UNAVAILABLE"
  | "OUTSIDE_HOURS"
  | "FREE";

export const CALENDAR_LABELS: Record<Exclude<CalendarState, "UNAVAILABLE">, string> = {
  CONFIRMED: "Confirmed",
  PENDING: "Pending",
  SETUP: "Setup",
  TURNAROUND: "Turnaround",
  OUTSIDE_HOURS: "Outside operating hours",
  FREE: "Free",
};

export const UNAVAILABILITY_LABELS: Record<string, string> = {
  MAINTENANCE: "Maintenance",
  EQUIPMENT_FAILURE: "Equipment failure",
  RENOVATION: "Renovation",
  SAFETY: "Safety",
  OTHER: "Other",
};

export const CALENDAR_APPEARANCE: Record<CalendarState, LozengeAppearance> = {
  CONFIRMED: "removed",
  PENDING: "moved",
  SETUP: "inprogress",
  TURNAROUND: "inprogress",
  UNAVAILABLE: "new",
  OUTSIDE_HOURS: "default",
  FREE: "success",
};

/** The day bar's fill for each state, matching its lozenge's colour. */
export const CALENDAR_BAR_COLOURS: Record<CalendarState, string> = {
  CONFIRMED: "#DE350B",
  PENDING: "#FF991F",
  SETUP: "#4C9AFF",
  TURNAROUND: "#4C9AFF",
  UNAVAILABLE: "#6554C0",
  OUTSIDE_HOURS: "#C1C7D0",
  FREE: "#57D9A3",
};
