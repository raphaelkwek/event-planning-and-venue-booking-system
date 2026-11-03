import { afterAll, afterEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import request from "supertest";
import { claimSeat } from "../../src/repo/seats.js";
import { CLOSES, DURING, ENDS, STARTS, DEADLINE, OPENS, anEvent, appAt, asAttendee, cleanUp } from "../support/fixtures.js";

/**
 * R1 — browse the events open for registration (GET /api/v1/open-events),
 * against the real registration schema. One test per card in tests/R1.
 */

const sql = postgres(process.env.DATABASE_URL!, { max: 4, prepare: false });
const clock = { now: DURING };
const app = appAt(sql, clock);
const me = randomUUID();

afterEach(async () => {
  clock.now = DURING;
  await cleanUp(sql);
});
afterAll(() => sql.end());

/** The open list, filtered to the events a test made, since other tests' events share the table. */
async function listed(eventIds: string[]) {
  const res = await request(app).get("/api/v1/open-events?limit=100").set(asAttendee(me));
  expect(res.status).toBe(200);
  const items = res.body.items as Array<Record<string, unknown>>;
  return items.filter((item) => eventIds.includes(item.eventId as string));
}

describe("GET /api/v1/open-events (R1)", () => {
  it("R1-T1 lists an open event with its name, description, date, times, venue, location and places remaining", async () => {
    const event = await anEvent(sql, { seats: 3 });

    const [item] = await listed([event.eventId]);

    expect(item).toEqual({
      eventId: event.eventId,
      reference: event.reference,
      name: "R Test Symposium",
      description: "A one-day symposium for the school of computing.",
      startsAt: STARTS,
      endsAt: ENDS,
      venues: [{ name: "Lee Kong Chian Auditorium", location: "School of Computing, Level 1" }],
      registrationOpensAt: OPENS,
      registrationClosesAt: CLOSES,
      withdrawalDeadline: DEADLINE,
      placesRemaining: 3,
      isFull: false,
    });
    const detail = await request(app).get(`/api/v1/open-events/${event.eventId}`).set(asAttendee(me));
    expect(detail.status).toBe(200);
    expect(detail.body).toEqual(item);
  });

  it("R1-T2 lists each of an event's two venues, and its places remaining is their total", async () => {
    const event = await anEvent(sql, {
      venues: [
        { seats: 3, venueName: "Lee Kong Chian Auditorium", venueLocation: "School of Computing, Level 1" },
        { seats: 2, venueName: "Seminar Room 2-1", venueLocation: "School of Computing, Level 2" },
      ],
    });

    const [item] = await listed([event.eventId]);

    expect(item!.venues).toEqual([
      { name: "Lee Kong Chian Auditorium", location: "School of Computing, Level 1" },
      { name: "Seminar Room 2-1", location: "School of Computing, Level 2" },
    ]);
    expect(item!.placesRemaining).toBe(5);
  });

  it("R1-T3 does not list a Confirmed event whose registration is not enabled", async () => {
    const off = await anEvent(sql, { registrationRequired: false, opensAt: null, closesAt: null, deadline: null });
    const on = await anEvent(sql);

    expect((await listed([off.eventId, on.eventId])).map((i) => i.eventId)).toEqual([on.eventId]);
    expect((await request(app).get(`/api/v1/open-events/${off.eventId}`).set(asAttendee(me))).status).toBe(404);
  });

  it("R1-T4 lists no event in any status but Confirmed, even with registration open", async () => {
    const statuses = ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "PLANNING", "SAFETY_REVIEW", "REJECTED", "CANCELLED", "COMPLETED"];
    const others = await Promise.all(statuses.map((status) => anEvent(sql, { status })));
    const confirmed = await anEvent(sql);

    expect((await listed([...others.map((e) => e.eventId), confirmed.eventId])).map((i) => i.eventId)).toEqual([confirmed.eventId]);
    for (const other of others) {
      const res = await request(app).get(`/api/v1/open-events/${other.eventId}`).set(asAttendee(me));
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("EVENT_NOT_FOUND");
    }
  });

  it("R1-T5 lists an event exactly at its closing instant, which has not passed, and not a millisecond after", async () => {
    const event = await anEvent(sql);

    clock.now = new Date(CLOSES);
    expect(await listed([event.eventId])).toHaveLength(1);
    clock.now = new Date(Date.parse(CLOSES) + 1);
    expect(await listed([event.eventId])).toHaveLength(0);
    expect((await request(app).get(`/api/v1/open-events/${event.eventId}`).set(asAttendee(me))).status).toBe(404);
  });

  it("R1-T6 shows an event with no places remaining as full", async () => {
    const event = await anEvent(sql, { seats: 3 });
    for (let i = 0; i < 3; i++) await claimSeat(sql, { eventId: event.eventId, pool: "PUBLIC", attendeeId: randomUUID() });

    const [item] = await listed([event.eventId]);

    expect(item).toMatchObject({ placesRemaining: 0, isFull: true });
  });

  it("R1-T7 shows one place remaining, not full, when one seat is left", async () => {
    const event = await anEvent(sql, { seats: 3 });
    for (let i = 0; i < 2; i++) await claimSeat(sql, { eventId: event.eventId, pool: "PUBLIC", attendeeId: randomUUID() });

    expect((await listed([event.eventId]))[0]).toMatchObject({ placesRemaining: 1, isFull: false });
  });

  it("R1-T8 sends only the published fields: nothing internal, no booking, layout, owner or equipment", async () => {
    const event = await anEvent(sql);

    const [item] = await listed([event.eventId]);

    expect(Object.keys(item!).sort()).toEqual(
      [
        "description",
        "endsAt",
        "eventId",
        "isFull",
        "name",
        "placesRemaining",
        "reference",
        "registrationClosesAt",
        "registrationOpensAt",
        "startsAt",
        "venues",
        "withdrawalDeadline",
      ].sort(),
    );
    expect(Object.keys((item!.venues as object[])[0]!).sort()).toEqual(["location", "name"]);
    expect(JSON.stringify(item)).not.toMatch(/owner|booking|layout|BKR-|coordinator|purpose|equipment/i);
  });

  it("lists soonest first, a page at a time", async () => {
    const later = await anEvent(sql, { startsAt: "2026-12-20T06:00:00.000Z", endsAt: "2026-12-20T10:00:00.000Z" });
    const sooner = await anEvent(sql, { startsAt: "2026-12-15T06:00:00.000Z", endsAt: "2026-12-15T10:00:00.000Z" });
    const ours = [sooner.eventId, later.eventId];

    expect((await listed(ours)).map((i) => i.eventId)).toEqual(ours);
    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const res = await request(app)
        .get(`/api/v1/open-events?limit=1${cursor ? `&cursor=${cursor}` : ""}`)
        .set(asAttendee(me));
      expect(res.body.items.length).toBeLessThanOrEqual(1);
      seen.push(...(res.body.items as { eventId: string }[]).map((i) => i.eventId).filter((id) => ours.includes(id)));
      cursor = res.body.nextCursor;
    } while (cursor);
    expect(seen).toEqual(ours);
  });

  it("needs a valid token, and refuses a page size or cursor it did not issue", async () => {
    expect((await request(app).get("/api/v1/open-events")).status).toBe(401);
    expect((await request(app).get("/api/v1/open-events").set({ Authorization: "Bearer bad" })).body.error.code).toBe("UNAUTHENTICATED");
    const big = await request(app).get("/api/v1/open-events?limit=101").set(asAttendee(me));
    expect(big.status).toBe(400);
    expect(big.body.error.fields).toEqual([{ field: "limit", message: "Give a whole number from 1 to 100." }]);
    const forged = await request(app).get("/api/v1/open-events?cursor=bm90LWEtY3Vyc29y").set(asAttendee(me));
    expect(forged.status).toBe(400);
    expect(forged.body.error.fields[0].field).toBe("cursor");
  });
});
