/**
 * Venue slots and unavailability blocks (EN-02.1, ADR-0006, implementation.md
 * §4.6). The venue migration's check constraints list the same values, and
 * planning-core's tests/boundaries/venueValues.test.ts fails if they drift.
 */

/** A hold's or booking's slot. Requires Reconfirmation is a flag on the slot, never one of these. */
export const VENUE_SLOT_STATUSES = ["HELD", "CONFIRMED", "RELEASED", "EXPIRED"] as const;
export type VenueSlotStatus = (typeof VENUE_SLOT_STATUSES)[number];

/** Only these block a period: the exclusion constraint ignores every other status. */
export const BLOCKING_SLOT_STATUSES = ["HELD", "CONFIRMED"] as const satisfies readonly VenueSlotStatus[];
export type BlockingSlotStatus = (typeof BLOCKING_SLOT_STATUSES)[number];

/** I2's reason types for a period of unavailability, as CR-02 lists them. */
export const UNAVAILABILITY_REASON_TYPES = ["MAINTENANCE", "EQUIPMENT_FAILURE", "RENOVATION", "SAFETY", "OTHER"] as const;
export type UnavailabilityReasonType = (typeof UNAVAILABILITY_REASON_TYPES)[number];

/** I2 removes a block by status, never by deleting it (§4.3). */
export const UNAVAILABILITY_BLOCK_STATUSES = ["ACTIVE", "REMOVED"] as const;
export type UnavailabilityBlockStatus = (typeof UNAVAILABILITY_BLOCK_STATUSES)[number];
