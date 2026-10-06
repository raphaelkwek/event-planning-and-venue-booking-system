import { afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { testDb } from "../../support/testDb.js";
import { insertVenueSlot, lockVenue, type NewVenueSlot } from "../../../src/modules/venue/repo/slots.js";
import { VenueSlotConflictError } from "../../../src/modules/venue/domain/slotConflict.js";

/**
 * EN-02.1 done-checks (ADR-0006, implementation.md §4.6), against real
 * Postgres: the exclusion constraint on venue_slots, occupied periods with
 * setup and turnaround time (H3, CR-01), the venue row lock that M1 and I2
 * take first, and the unavailability_blocks table that I2 writes to.
 *
 * Every test makes its own venue, so none depends on or disturbs another's rows.
 */

const sql = testDb();
const ACTOR = "a3333333-0000-0000-0000-000000000001";

afterAll(async () => {
  await sql.end();
});

async function newVenue(): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    insert into venue.venues (name, building, max_capacity, layouts, operating_hours, created_by, updated_by)
    values (${`EN-02.1 Test Room ${randomUUID().slice(0, 8)}`}, 'EN-02.1 Test Building', 50,
            ${sql.json([{ name: "Theatre", capacity: 50 }])}, ${sql.json({})}, ${ACTOR}, ${ACTOR})
    returning id
  `;
  return row!.id;
}

/** A time on Monday 2 Nov 2026, Singapore time. */
const at = (hhmm: string) => new Date(`2026-11-02T${hhmm}:00+08:00`);

function slot(venueId: string, overrides: Partial<NewVenueSlot> = {}): NewVenueSlot {
  return {
    venueId,
    eventId: randomUUID(),
    reference: `BR-${randomUUID().slice(0, 8)}`,
    startsAt: at("10:00"),
    endsAt: at("12:00"),
    setupMinutes: 0,
    turnaroundMinutes: 0,
    status: "CONFIRMED",
    actorUserId: ACTOR,
    ...overrides,
  };
}

const take = (s: NewVenueSlot) => sql.begin((tx) => insertVenueSlot(tx, s));

async function slotCount(venueId: string): Promise<number> {
  const [row] = await sql<{ n: number }[]>`select count(*)::int as n from venue.venue_slots where venue_id = ${venueId}`;
  return row!.n;
}

describe("venue_slots: one hold or booking per venue and period (N1, L3, M1)", () => {
  it("refuses a booking that overlaps another, names the one it overlaps, and stores nothing", async () => {
    const venueId = await newVenue();
    await take(slot(venueId, { reference: "BR-FIRST" }));

    const refused = take(slot(venueId, { startsAt: at("11:00"), endsAt: at("13:00") }));

    await expect(refused).rejects.toBeInstanceOf(VenueSlotConflictError);
    await expect(refused).rejects.toMatchObject({ code: "VENUE_SLOT_CONFLICT", conflictingReferences: ["BR-FIRST"] });
    expect(await slotCount(venueId)).toBe(1);
  });

  it("treats holds and confirmed bookings alike: either one blocks the other", async () => {
    const heldVenue = await newVenue();
    await take(slot(heldVenue, { status: "HELD", reference: "HOLD-1" }));
    await expect(take(slot(heldVenue, { status: "CONFIRMED" }))).rejects.toMatchObject({
      conflictingReferences: ["HOLD-1"],
    });
    await expect(take(slot(heldVenue, { status: "HELD" }))).rejects.toBeInstanceOf(VenueSlotConflictError);

    const bookedVenue = await newVenue();
    await take(slot(bookedVenue, { status: "CONFIRMED", reference: "BR-1" }));
    await expect(take(slot(bookedVenue, { status: "HELD" }))).rejects.toMatchObject({
      conflictingReferences: ["BR-1"],
    });
  });

  it("names every slot the new period overlaps", async () => {
    const venueId = await newVenue();
    await take(slot(venueId, { reference: "BR-MORNING", startsAt: at("09:00"), endsAt: at("10:00") }));
    await take(slot(venueId, { reference: "BR-NOON", startsAt: at("11:00"), endsAt: at("12:00") }));

    await expect(take(slot(venueId, { startsAt: at("09:30"), endsAt: at("11:30") }))).rejects.toMatchObject({
      conflictingReferences: ["BR-MORNING", "BR-NOON"],
    });
  });

  it("allows periods that merely touch (boundary: one ends at 12:00, the next starts at 12:00)", async () => {
    const venueId = await newVenue();
    await take(slot(venueId, { startsAt: at("10:00"), endsAt: at("12:00") }));
    await take(slot(venueId, { startsAt: at("12:00"), endsAt: at("14:00") }));
    await take(slot(venueId, { startsAt: at("08:00"), endsAt: at("10:00") }));

    expect(await slotCount(venueId)).toBe(3);
  });

  it("allows the same period at a different venue", async () => {
    const first = await newVenue();
    const second = await newVenue();
    await take(slot(first));
    await take(slot(second));

    expect(await slotCount(first)).toBe(1);
    expect(await slotCount(second)).toBe(1);
  });

  it("never blocks a period with a released or expired slot", async () => {
    const venueId = await newVenue();
    const released = await take(slot(venueId));
    await sql`update venue.venue_slots set status = 'RELEASED' where id = ${released.id}`;
    const expired = await take(slot(venueId, { status: "HELD" }));
    await sql`update venue.venue_slots set status = 'EXPIRED' where id = ${expired.id}`;

    const taken = await take(slot(venueId));

    expect(taken.status).toBe("CONFIRMED");
    expect(await slotCount(venueId)).toBe(3);
  });

  it("keeps blocking with a booking flagged Requires Reconfirmation, which stays CONFIRMED", async () => {
    const venueId = await newVenue();
    const flagged = await take(slot(venueId, { reference: "BR-FLAGGED" }));
    await sql`update venue.venue_slots set requires_reconfirmation = true where id = ${flagged.id}`;

    await expect(take(slot(venueId))).rejects.toMatchObject({ conflictingReferences: ["BR-FLAGGED"] });
    const [row] = await sql<{ status: string }[]>`select status from venue.venue_slots where id = ${flagged.id}`;
    expect(row!.status).toBe("CONFIRMED");
  });

  it("refuses a slot that ends before it starts, or with negative buffers, and stores nothing", async () => {
    const venueId = await newVenue();

    await expect(take(slot(venueId, { startsAt: at("12:00"), endsAt: at("10:00") }))).rejects.toMatchObject({
      code: "23514",
    });
    await expect(take(slot(venueId, { startsAt: at("12:00"), endsAt: at("12:00") }))).rejects.toMatchObject({
      code: "23514",
    });
    await expect(take(slot(venueId, { setupMinutes: -1 }))).rejects.toMatchObject({ code: "23514" });
    expect(await slotCount(venueId)).toBe(0);
  });

  it("returns the stored slot, unflagged", async () => {
    const venueId = await newVenue();
    const eventId = randomUUID();

    const taken = await take(slot(venueId, { eventId, reference: "BR-RETURNED", status: "HELD" }));

    expect(taken).toMatchObject({
      venueId,
      eventId,
      reference: "BR-RETURNED",
      status: "HELD",
      requiresReconfirmation: false,
      startsAt: at("10:00"),
      endsAt: at("12:00"),
    });
    expect(taken.id).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("occupied periods: setup and turnaround time (H3, CR-01)", () => {
  it("occupies 09:30 to 12:45 for a 10:00 to 12:00 event with 30 minutes' setup and 45 minutes' turnaround", async () => {
    const venueId = await newVenue();

    const taken = await take(slot(venueId, { setupMinutes: 30, turnaroundMinutes: 45 }));

    expect(taken.occupiedFrom).toEqual(at("09:30"));
    expect(taken.occupiedUntil).toEqual(at("12:45"));
    expect(taken.startsAt).toEqual(at("10:00"));
    expect(taken.endsAt).toEqual(at("12:00"));
  });

  it("refuses a booking that starts inside another booking's turnaround time", async () => {
    const venueId = await newVenue();
    await take(slot(venueId, { reference: "BR-TURNAROUND", turnaroundMinutes: 45 }));

    await expect(take(slot(venueId, { startsAt: at("12:30"), endsAt: at("13:30") }))).rejects.toMatchObject({
      conflictingReferences: ["BR-TURNAROUND"],
    });
  });

  it("refuses a booking whose own setup time reaches back into another booking", async () => {
    const venueId = await newVenue();
    await take(slot(venueId, { reference: "BR-EARLIER" }));

    await expect(
      take(slot(venueId, { startsAt: at("12:15"), endsAt: at("13:00"), setupMinutes: 30 })),
    ).rejects.toMatchObject({ conflictingReferences: ["BR-EARLIER"] });
  });

  it("allows occupied periods that merely touch (boundary: 12:45 turnaround end, 12:45 setup start)", async () => {
    const venueId = await newVenue();
    await take(slot(venueId, { turnaroundMinutes: 45 }));

    await take(slot(venueId, { startsAt: at("13:00"), endsAt: at("14:00"), setupMinutes: 15 }));

    expect(await slotCount(venueId)).toBe(2);
  });
});

describe("two attempts at the same moment (implementation.md §8.1)", () => {
  it("lets exactly one of two simultaneous bookings for the same period through", async () => {
    const venueId = await newVenue();

    const results = await Promise.allSettled([take(slot(venueId)), take(slot(venueId))]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const refused = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(refused?.reason).toBeInstanceOf(VenueSlotConflictError);
    expect(await slotCount(venueId)).toBe(1);
  });
});

describe("lockVenue: approval and blocking serialise per venue (M1, I2)", () => {
  it("says so when the venue does not exist", async () => {
    await expect(sql.begin((tx) => lockVenue(tx, randomUUID()))).resolves.toBe(false);
  });

  it("holds the venue row until its transaction ends, so a second locker waits", async () => {
    const venueId = await newVenue();
    let lockTaken!: () => void;
    const taken = new Promise<void>((resolve) => (lockTaken = resolve));
    let finishFirst!: () => void;
    const firstMayFinish = new Promise<void>((resolve) => (finishFirst = resolve));

    const first = sql.begin(async (tx) => {
      const locked = await lockVenue(tx, venueId);
      lockTaken();
      await firstMayFinish;
      return locked;
    });
    await taken;

    // While the first transaction holds the row, a second can't take it.
    const second = sql.begin(async (tx) => {
      await tx`set local lock_timeout = '300ms'`;
      return lockVenue(tx, venueId);
    });
    await expect(second).rejects.toMatchObject({ code: "55P03" });

    finishFirst();
    await expect(first).resolves.toBe(true);
    // Once the first transaction ends, the row is free again.
    await expect(sql.begin((tx) => lockVenue(tx, venueId))).resolves.toBe(true);
  });
});

describe("unavailability_blocks (I2)", () => {
  async function block(venueId: string, fields: { reasonType?: string; description?: string; startsAt?: Date; endsAt?: Date } = {}) {
    const [row] = await sql<{ id: string; status: string; from: Date; until: Date }[]>`
      insert into venue.unavailability_blocks
        (venue_id, starts_at, ends_at, reason_type, description, created_by, updated_by)
      values (${venueId}, ${fields.startsAt ?? at("08:00")}, ${fields.endsAt ?? at("18:00")},
              ${fields.reasonType ?? "MAINTENANCE"}, ${fields.description ?? "Air conditioning repair"}, ${ACTOR}, ${ACTOR})
      returning id, status, lower(period) as from, upper(period) as until
    `;
    return row!;
  }

  it("records a block with its period, reason type and description, active from the start", async () => {
    const venueId = await newVenue();

    const created = await block(venueId, { reasonType: "EQUIPMENT_FAILURE" });

    expect(created).toMatchObject({ status: "ACTIVE", from: at("08:00"), until: at("18:00") });
  });

  it("refuses a block that ends before it starts, an unknown reason type, or an empty description", async () => {
    const venueId = await newVenue();

    await expect(block(venueId, { startsAt: at("18:00"), endsAt: at("08:00") })).rejects.toMatchObject({ code: "23514" });
    await expect(block(venueId, { reasonType: "HOLIDAY" })).rejects.toMatchObject({ code: "23514" });
    await expect(block(venueId, { description: "   " })).rejects.toMatchObject({ code: "23514" });
  });

  it("refuses a block for a venue that does not exist", async () => {
    await expect(block(randomUUID())).rejects.toMatchObject({ code: "23503" });
  });

  it("does not refuse a block that overlaps a booking: I2 flags the booking instead", async () => {
    const venueId = await newVenue();
    await take(slot(venueId));

    const created = await block(venueId, { startsAt: at("11:00"), endsAt: at("15:00") });

    expect(created.status).toBe("ACTIVE");
  });
});
