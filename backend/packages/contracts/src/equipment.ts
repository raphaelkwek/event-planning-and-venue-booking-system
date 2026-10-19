/**
 * Equipment inventory and reservations (EN-02.2, ADR-0006, implementation.md
 * §4.6). The equipment migration's check constraints list the same values, and
 * planning-core's tests/boundaries/equipmentValues.test.ts fails if they drift.
 */

/** A projector is tracked unit by unit; chairs are bulk stock, counted by quantity. */
export const EQUIPMENT_KINDS = ["SERIALIZED", "BULK"] as const;
export type EquipmentKind = (typeof EQUIPMENT_KINDS)[number];

/** For unit and bulk reservations alike. Q2 releases by status, never by deleting. */
export const EQUIPMENT_RESERVATION_STATUSES = ["RESERVED", "RELEASED"] as const;
export type EquipmentReservationStatus = (typeof EQUIPMENT_RESERVATION_STATUSES)[number];

/** P2 marks a unit, or a quantity of bulk stock, unavailable for a period. */
export const EQUIPMENT_UNAVAILABILITY_STATUSES = ["ACTIVE", "REMOVED"] as const;
export type EquipmentUnavailabilityStatus = (typeof EQUIPMENT_UNAVAILABILITY_STATUSES)[number];

/**
 * O1/O2: one line of an event's equipment request. The names are the stories' own
 * words. REMOVED is what O1's removal sets (nothing is deleted, §4.3); RESERVED is
 * set by Q1 (Sprint 3) and is listed now because O1 must refuse to edit such a line.
 */
export const EQUIPMENT_REQUEST_LINE_STATUSES = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "CONFIRMED",
  "UNAVAILABLE",
  "SUBSTITUTED",
  "RESERVED",
  "REMOVED",
] as const;
export type EquipmentRequestLineStatus = (typeof EQUIPMENT_REQUEST_LINE_STATUSES)[number];

/** O1: the assigned coordinator may edit or remove a line only while it has one of these. */
export const EQUIPMENT_LINE_EDITABLE_STATUSES: readonly EquipmentRequestLineStatus[] = ["SUBMITTED", "UNDER_REVIEW"];

/** O2: the statuses Technical Support may set. Reserved is Q1's, Submitted and Removed are O1's. */
export const EQUIPMENT_LINE_STAFF_STATUSES = ["UNDER_REVIEW", "CONFIRMED", "UNAVAILABLE", "SUBSTITUTED"] as const;
export type EquipmentLineStaffStatus = (typeof EQUIPMENT_LINE_STAFF_STATUSES)[number];

/** How a line status reads to a user. The UI and notifications never invent their own wording. */
export const EQUIPMENT_LINE_STATUS_LABELS: Record<EquipmentRequestLineStatus, string> = {
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under Review",
  CONFIRMED: "Confirmed",
  UNAVAILABLE: "Unavailable",
  SUBSTITUTED: "Substituted",
  RESERVED: "Reserved",
  REMOVED: "Removed",
};

/** What the line's audit trail records (O1 save, edit, removal; O2 status change). */
export const EQUIPMENT_LINE_HISTORY_ACTIONS = ["CREATED", "EDITED", "REMOVED", "STATUS_CHANGED"] as const;
export type EquipmentLineHistoryAction = (typeof EQUIPMENT_LINE_HISTORY_ACTIONS)[number];
