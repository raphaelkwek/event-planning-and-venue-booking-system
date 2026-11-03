import { afterAll, beforeAll, describe, expect, it } from "vitest";
import "dotenv/config";
import { sql } from "../src/db.js";
import { countInvariantViolations, INVARIANT_VIOLATIONS_SQL } from "../src/overAdmission.js";

/**
 * EN-17-T5 against a real database: the invariant query reads nothing wrong
 * for rows the schema allows. The violating rows cannot be inserted while the
 * constraints exist, so the second test drops them inside a transaction it
 * then rolls back.
 */
const EVENT = "00000000-0000-4000-8000-0000000017a1";
const BOOKING = "00000000-0000-4000-8000-0000000017b1";
const USER = "00000000-0000-4000-8000-0000000017c1";

class Rollback extends Error {}

describe("EN-17-T5 over-admission gauge against Postgres", () => {
  beforeAll(async () => {
    await sql`delete from registration.seats where event_id = ${EVENT}`;
  });
  afterAll(async () => {
    await sql`delete from registration.seats where event_id = ${EVENT}`;
    await sql.end({ timeout: 5 });
  });

  it("EN-17-T5 adds nothing for a plan with a free seat and a claimed seat", async () => {
    const before = await countInvariantViolations(sql);
    await sql`insert into registration.seats (event_id, booking_id, seat_no) values (${EVENT}, ${BOOKING}, 1)`;
    await sql`insert into registration.seats (event_id, booking_id, seat_no, status, claimed_by, claimed_at)
              values (${EVENT}, ${BOOKING}, 2, 'CLAIMED', ${USER}, now())`;
    expect(await countInvariantViolations(sql)).toBe(before);
    await sql`delete from registration.seats where event_id = ${EVENT}`;
  });

  it("EN-17-T5 counts a duplicated seat number and a holder-less claimed seat once the constraints are gone", async () => {
    const before = await countInvariantViolations(sql);
    await expect(
      sql.begin(async (tx) => {
        await tx`alter table registration.seats drop constraint seats_booking_id_seat_no_key`;
        await tx`alter table registration.seats drop constraint seats_check`;
        await tx`insert into registration.seats (event_id, booking_id, seat_no) values (${EVENT}, ${BOOKING}, 1), (${EVENT}, ${BOOKING}, 1)`;
        await tx`insert into registration.seats (event_id, booking_id, seat_no, status) values (${EVENT}, ${BOOKING}, 3, 'CLAIMED')`;
        const rows = await INVARIANT_VIOLATIONS_SQL(tx as unknown as typeof sql);
        expect(Number(rows[0]!.violations)).toBe(before + 2);
        throw new Rollback();
      }),
    ).rejects.toBeInstanceOf(Rollback);
  });
});
