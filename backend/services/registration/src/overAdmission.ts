import type { Sql } from "postgres";
import { Gauge, type Registry } from "@connectsphere/observability";

/**
 * The "zero over-admission" SLI (EN-17, ADR-0013), read from the registration
 * database rather than counted in the claim path: the claim code (R2) is not
 * merged yet, and a count kept by the code that could be wrong would share
 * that code's blind spot.
 *
 * Over-admission here means the seat table has stopped being the single
 * source of truth for who may attend. Two rows break it, and both are already
 * refused by constraints (the CHECK on seats and UNIQUE (booking_id, seat_no)).
 * The gauge is the canary for those constraints being dropped, left NOT VALID
 * or bypassed by a manual edit, so a healthy system reports 0 forever and any
 * other number is an incident. When R2 adds registrations, extend the query
 * with "registrations without a seat" and "seats with two registrations".
 */
export const INVARIANT_VIOLATIONS_SQL = (sql: Sql) => sql`
  select (
      (select count(*) from registration.seats where status = 'CLAIMED' and claimed_by is null)
    + (select count(*) from (
         select 1 from registration.seats group by booking_id, seat_no having count(*) > 1
       ) duplicated)
  )::int as violations
`;

export async function countInvariantViolations(sql: Sql): Promise<number> {
  const rows = await INVARIANT_VIOLATIONS_SQL(sql);
  return Number(rows[0]?.violations ?? 0);
}

/** Registers the two gauges, evaluated on each scrape. */
export function registerOverAdmissionGauges(registry: Registry, sql: Sql): void {
  const violations = new Gauge({
    name: "registration_over_admission_seats",
    help: "Seat rows that break the one-seat-one-holder invariant. Must be 0.",
    registers: [registry],
    async collect() {
      try {
        violations.set(await countInvariantViolations(sql));
        checkOk.set(1);
      } catch {
        // Keep the last value and say the check did not run, so a database
        // outage is not read as "no over-admission".
        checkOk.set(0);
      }
    },
  });
  const checkOk = new Gauge({
    name: "registration_invariant_check_success",
    help: "1 when the last over-admission check ran, 0 when it could not (for example the database was unreachable).",
    registers: [registry],
  });
}
