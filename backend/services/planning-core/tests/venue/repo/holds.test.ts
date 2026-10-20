import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { testDb } from "../../support/testDb.js";
import {
  HeldSlotNotHeldError,
  confirmHeldSlotForRequest,
  findHold,
  insertHold,
  markHoldConverted,
  placeHold,
  releaseHeldSlotForRequest,
  releaseHoldsForEvent,
} from "../../../src/modules/venue/repo/holds.js";
import { insertBookingRequest } from "../../../src/modules/venue/repo/bookingRequests.js";

/**
 * L3 — what the venue module offers the stories that finish a hold's life:
 * M1 confirms, and M2 and L2 release, the period a converted hold took
 * (implementation.md §4.6 rule 3); F4 releases a cancelled event's holds.
 */

const sql = testDb();
const ACTOR = "a9999999-0000-0000-0000-000000000071";

async function cleanUp() {
  const ours = sql`select id from venue.venues where created_by = ${ACTOR}`;
  await sql`delete from venue.holds where venue_id in (${ours})`;
  await sql`delete from venue.booking_requests where venue_id in (${ours})`;
  await sql`delete from venue.venue_slots where venue_id in (${ours})`;
  await sql`delete from venue.venues where created_by = ${ACTOR}`;
}

beforeEach(cleanUp);
afterAll(async () => {
  await cleanUp();
  await sql.end();
});

async function newVenue(): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    insert into venue.venues (name, building, max_capacity, layouts, operating_hours, created_by, updated_by)
    values (${`L3 Repo Room ${randomUUID().slice(0, 8)}`}, 'L3 Test Building', 100,
            ${sql.json([{ name: "Theatre", capacity: 100 }])}, ${sql.json({})}, ${ACTOR}, ${ACTOR})
    returning id
  `;
  return row!.id;
}

const START = "2026-12-02T06:00:00.000Z";
const END = "2026-12-02T10:00:00.000Z";

/** A hold placed at a new venue, and (optionally) converted into a pending request. */
async function setUp(options: { convert: boolean }) {
  const venueId = await newVenue();
  const eventId = randomUUID();
  return sql.begin(async (tx) => {
    const requested = await insertHold(tx, { eventId, venueId, startsAt: START, endsAt: END, reminderLeadMinutes: 60, requestedBy: ACTOR });
    const held = await placeHold(tx, requested, {
      expiresAt: "2026-12-01T10:00:00.000Z",
      setupMinutes: 0,
      turnaroundMinutes: 0,
      actorUserId: ACTOR,
    });
    if (!options.convert) return { venueId, eventId, hold: held, requestId: null as string | null };
    const created = await insertBookingRequest(tx, {
      eventId,
      venueId,
      startsAt: START,
      endsAt: END,
      layout: "Theatre",
      expectedAttendance: 50,
      facilities: [],
      accessibilityFeatures: [],
      eventStartsAt: START,
      eventEndsAt: END,
      eventAttendance: 50,
      differsFromEvent: false,
      replacesBookingId: null,
      // K2: every request records its venue's suitability; this one needs no justification.
      suitabilityStatus: "SUITABLE",
      suitabilityReasons: [],
      justification: null,
      requestedBy: ACTOR,
    });
    const hold = await markHoldConverted(tx, held, created, ACTOR);
    return { venueId, eventId, hold, requestId: created.id as string | null };
  });
}

async function slotStatus(slotId: string): Promise<string> {
  const [row] = await sql<{ status: string }[]>`select status from venue.venue_slots where id = ${slotId}`;
  return row!.status;
}

describe("confirmHeldSlotForRequest (for M1)", () => {
  it("confirms the slot a converted hold took, and returns its id for the request's booking", async () => {
    const { hold, requestId } = await setUp({ convert: true });
    const slotId = await sql.begin((tx) => confirmHeldSlotForRequest(tx, requestId!, ACTOR));
    expect(slotId).toBe(hold.slotId);
    expect(await slotStatus(hold.slotId!)).toBe("CONFIRMED");
  });

  it("returns null for a request that wasn't converted from a hold, so M1 inserts a slot as before", async () => {
    const { requestId } = await setUp({ convert: true });
    const unrelated = randomUUID();
    expect(await sql.begin((tx) => confirmHeldSlotForRequest(tx, unrelated, ACTOR))).toBeNull();
    expect(requestId).not.toBe(unrelated);
  });

  it("refuses a slot that is no longer HELD", async () => {
    const { hold, requestId } = await setUp({ convert: true });
    await sql`update venue.venue_slots set status = 'RELEASED' where id = ${hold.slotId!}`;
    await expect(sql.begin((tx) => confirmHeldSlotForRequest(tx, requestId!, ACTOR))).rejects.toBeInstanceOf(HeldSlotNotHeldError);
  });
});

describe("releaseHeldSlotForRequest (for M2, and wired into L2)", () => {
  it("releases the slot a converted hold took, once", async () => {
    const { hold, requestId } = await setUp({ convert: true });
    expect(await sql.begin((tx) => releaseHeldSlotForRequest(tx, requestId!, ACTOR))).toBe(true);
    expect(await slotStatus(hold.slotId!)).toBe("RELEASED");
    expect(await sql.begin((tx) => releaseHeldSlotForRequest(tx, requestId!, ACTOR))).toBe(false);
  });

  it("does nothing for a request that wasn't converted from a hold", async () => {
    expect(await sql.begin((tx) => releaseHeldSlotForRequest(tx, randomUUID(), ACTOR))).toBe(false);
  });

  it("leaves a confirmed booking confirmed", async () => {
    const { hold, requestId } = await setUp({ convert: true });
    await sql.begin((tx) => confirmHeldSlotForRequest(tx, requestId!, ACTOR));
    expect(await sql.begin((tx) => releaseHeldSlotForRequest(tx, requestId!, ACTOR))).toBe(false);
    expect(await slotStatus(hold.slotId!)).toBe("CONFIRMED");
  });
});

describe("releaseHoldsForEvent (for F4)", () => {
  it("releases the event's requested and held holds and their slots, leaving converted ones to their requests", async () => {
    const { eventId, hold } = await setUp({ convert: false });
    const seminar = await newVenue();
    const requested = await sql.begin((tx) =>
      insertHold(tx, { eventId, venueId: seminar, startsAt: START, endsAt: END, reminderLeadMinutes: 60, requestedBy: ACTOR }),
    );

    const released = await sql.begin((tx) => releaseHoldsForEvent(tx, eventId, ACTOR));

    expect(released.sort()).toEqual([hold.reference, requested.reference].sort());
    expect((await findHold(sql, hold.id))!.status).toBe("RELEASED");
    expect((await findHold(sql, requested.id))!.status).toBe("RELEASED");
    expect(await slotStatus(hold.slotId!)).toBe("RELEASED");

    const converted = await setUp({ convert: true });
    expect(await sql.begin((tx) => releaseHoldsForEvent(tx, converted.eventId, ACTOR))).toEqual([]);
    expect(await slotStatus(converted.hold.slotId!)).toBe("HELD");
  });
});
