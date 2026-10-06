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
