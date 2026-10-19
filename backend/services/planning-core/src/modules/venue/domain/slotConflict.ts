import type { ErrorCode } from "@connectsphere/contracts";

/**
 * EN-02.1: Postgres decides whether two slots overlap, through the exclusion
 * constraint on venue.venue_slots (ADR-0006). These rules only recognise its
 * refusal and name what the new period overlaps (implementation.md §4.6).
 */

export const SLOT_OVERLAP_CONSTRAINT = "venue_slot_no_overlap";

/** Postgres exclusion_violation. */
const EXCLUSION_VIOLATION = "23P01";

/** True when a database error is the venue slot constraint refusing an overlap. */
export function isSlotOverlap(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const { code, constraint_name } = error as { code?: unknown; constraint_name?: unknown };
  return code === EXCLUSION_VIOLATION && constraint_name === SLOT_OVERLAP_CONSTRAINT;
}

function listed(items: readonly string[]): string {
  if (items.length === 1) return items[0]!;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/**
 * The refusal names every hold or booking the new period overlaps. The list can
 * be empty if the overlapped slot was released between the refusal and the
 * look-up; the refusal still stands, because the constraint decided.
 */
export function slotConflictMessage(references: readonly string[]): string {
  const overlapped = references.length === 0 ? "another hold or booking" : listed(references);
  return `This period overlaps ${overlapped} at this venue, counting setup and turnaround time.`;
}

export class VenueSlotConflictError extends Error {
  readonly code = "VENUE_SLOT_CONFLICT" satisfies ErrorCode;

  constructor(readonly conflictingReferences: readonly string[]) {
    super(slotConflictMessage(conflictingReferences));
    this.name = "VenueSlotConflictError";
  }
}
