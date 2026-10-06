import type { ErrorCode } from "@connectsphere/contracts";

/**
 * EN-02.2 (ADR-0006, implementation.md §4.6): how much equipment is free over a
 * period. Bulk stock is limited by its **peak concurrent use** inside the
 * window: the most in use at any one moment. Back-to-back reservations don't
 * count as simultaneous.
 *
 * P1's text could also be read as adding up every overlapping reservation. The
 * customer's answer to CQ-02 (SPM-157) decides. Until then the rule lives here
 * and nowhere else, so changing it is a one-file change.
 */

export interface QuantityInPeriod {
  start: Date;
  end: Date;
  quantity: number;
}

export interface Window {
  start: Date;
  end: Date;
}

/** The highest total quantity in use at any instant inside the half-open window [start, end). */
export function peakConcurrentUse(uses: readonly QuantityInPeriod[], window: Window): number {
  const changes = uses
    .map((use) => ({
      from: Math.max(use.start.getTime(), window.start.getTime()),
      until: Math.min(use.end.getTime(), window.end.getTime()),
      quantity: use.quantity,
    }))
    // Equivalent mutants (EN-06.2): a use outside the window clips to an empty or inverted span whose end
    // sorts before its start, so it nets to zero and never raises the peak. Dropping or loosening this
    // filter can't change the result; it's kept for clarity. Stryker's "remove the .filter call" mutant
    // survives for the same reason; it's reported on the chain's first line, alongside the sort mutant
    // that the out-of-order test kills, so it isn't disabled.
    // Stryker disable next-line ConditionalExpression,EqualityOperator: equivalent, see above
    .filter((use) => use.from < use.until)
    .flatMap((use) => [
      { at: use.from, delta: use.quantity },
      { at: use.until, delta: -use.quantity },
    ])
    // At the same instant, ends come before starts: periods that merely touch don't overlap.
    .sort((a, b) => a.at - b.at || a.delta - b.delta);

  return changes.reduce(
    (state, change) => {
      const inUse = state.inUse + change.delta;
      return { inUse, peak: Math.max(state.peak, inUse) };
    },
    { inUse: 0, peak: 0 },
  ).peak;
}

/** What remains of the total once the peak use is taken out; never below zero. */
export function availableQuantity(total: number, peakUse: number): number {
  return Math.max(total - peakUse, 0);
}

/** How many of the requested quantity can't be met; zero when all of it can. */
export function shortfall(requested: number, available: number): number {
  return Math.max(requested - available, 0);
}

export const UNIT_OVERLAP_CONSTRAINT = "unit_not_double_reserved";

/** Postgres exclusion_violation. */
const EXCLUSION_VIOLATION = "23P01";

/** True when a database error is the per-unit constraint refusing an overlapping reservation. */
export function isUnitOverlap(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const { code, constraint_name } = error as { code?: unknown; constraint_name?: unknown };
  return code === EXCLUSION_VIOLATION && constraint_name === UNIT_OVERLAP_CONSTRAINT;
}

/** Q1: the refusal names insufficient availability and the shortfall, and nothing is reserved. */
export class InsufficientEquipmentError extends Error {
  readonly code = "INSUFFICIENT_EQUIPMENT" satisfies ErrorCode;
  readonly requested: number;
  readonly available: number;
  readonly shortfall: number;

  constructor({ requested, available }: { requested: number; available: number }) {
    const short = shortfall(requested, available);
    super(`Not enough available for this period: ${requested} requested, ${available} available, ${short} short.`);
    this.name = "InsufficientEquipmentError";
    this.requested = requested;
    this.available = available;
    this.shortfall = short;
  }
}

/** A unit was claimed for an overlapping period first. Q1 tries another free unit, or refuses with the shortfall. */
export class UnitAlreadyReservedError extends Error {
  constructor(readonly unitLabel: string) {
    super(`${unitLabel} is already reserved for an overlapping period.`);
    this.name = "UnitAlreadyReservedError";
  }
}
