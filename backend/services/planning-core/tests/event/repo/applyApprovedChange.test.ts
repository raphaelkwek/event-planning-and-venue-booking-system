import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { testDb } from "../../support/testDb.js";
import { deleteSeededEvents, seedEvent } from "../../support/seedEvent.js";
import { applyApprovedChange } from "../../../src/modules/event/repo/events.js";
import type { ChangeableEvent } from "../../../src/modules/event/domain/proposedChange.js";

/** S2 — an approved change is written with one history entry per field (AC3). CI only. */

const sql = testDb();
const OWNER = randomUUID();
const COORDINATOR = randomUUID();

beforeEach(() => deleteSeededEvents(sql, [OWNER]));
afterAll(async () => {
  await deleteSeededEvents(sql, [OWNER]);
  await sql.end();
});

describe("applyApprovedChange", () => {
  it("writes the values, raises the version and records the text of each field's change", async () => {
    const id = await seedEvent(sql, { ownerId: OWNER, status: "CONFIRMED", endsAt: new Date("2027-03-02T18:00:00.000Z") });
    const [before] = await sql<{ version: number; start: Date }[]>`
      select version, proposed_start_at as start from event.events where id = ${id}`;
    const current = {
      proposedStartAt: before!.start.toISOString(),
      expectedAttendance: 150,
      venueRequirements: null,
    } as unknown as ChangeableEvent;

    await sql.begin((tx) =>
      applyApprovedChange(
        tx,
        { id, current },
        { expectedAttendance: 220, venueRequirements: { minCapacity: 250 } },
        { userId: COORDINATOR, role: "EVENT_COORDINATOR" },
      ),
    );

    const [after] = await sql<
      { version: number; expected_attendance: number; venue_requirements: unknown; start: Date; updated_by: string }[]
    >`select version, expected_attendance, venue_requirements, proposed_start_at as start, updated_by
      from event.events where id = ${id}`;
    expect(after!.expected_attendance).toBe(220);
    expect(after!.venue_requirements).toEqual({ minCapacity: 250 });
    expect(after!.start.toISOString()).toBe(before!.start.toISOString());
    expect(after!.version).toBe(before!.version + 1);
    expect(after!.updated_by).toBe(COORDINATOR);

    const history = await sql<{ field_name: string; previous_value: string | null; new_value: string | null; triggering_action: string; actor_role: string }[]>`
      select field_name, previous_value, new_value, triggering_action, actor_role
      from event.event_history where event_id = ${id} and entry_type = 'FIELD_CHANGE' order by field_name`;
    expect(history).toEqual([
      { field_name: "expectedAttendance", previous_value: "150", new_value: "220", triggering_action: "CHANGE_REQUEST_APPROVED", actor_role: "EVENT_COORDINATOR" },
      { field_name: "venueRequirements", previous_value: null, new_value: '{"minCapacity":250}', triggering_action: "CHANGE_REQUEST_APPROVED", actor_role: "EVENT_COORDINATOR" },
    ]);
  });

  it("keeps an instant as UTC text, an array as JSON, and stores a JSON-null proposal as SQL NULL", async () => {
    const id = await seedEvent(sql, { ownerId: OWNER, status: "CONFIRMED", endsAt: new Date("2027-03-02T18:00:00.000Z") });
    await sql`update event.events set venue_requirements = '{"minCapacity":100}'::jsonb where id = ${id}`;
    const lines = [{ equipmentTypeId: randomUUID(), quantity: 2 }];
    const current = {
      proposedEndAt: "2027-03-02T18:00:00.000Z",
      venueRequirements: { minCapacity: 100 },
      equipmentRequirements: null,
    } as unknown as ChangeableEvent;

    await sql.begin((tx) =>
      applyApprovedChange(
        tx,
        { id, current },
        { proposedEndAt: "2027-03-02T19:30:00+01:00", venueRequirements: null, equipmentRequirements: lines },
        { userId: COORDINATOR, role: "EVENT_COORDINATOR" },
      ),
    );

    const [after] = await sql<{ venue: unknown; equipment: unknown; end: Date; venue_is_null: boolean }[]>`
      select venue_requirements as venue, equipment_requirements as equipment, proposed_end_at as end,
             venue_requirements is null as venue_is_null from event.events where id = ${id}`;
    expect(after!.venue_is_null).toBe(true);
    expect(after!.equipment).toEqual(lines);
    expect(after!.end.toISOString()).toBe("2027-03-02T18:30:00.000Z");
    const history = await sql<{ field_name: string; previous_value: string | null; new_value: string | null }[]>`
      select field_name, previous_value, new_value from event.event_history
      where event_id = ${id} and entry_type = 'FIELD_CHANGE' order by field_name`;
    expect(history).toEqual([
      { field_name: "equipmentRequirements", previous_value: null, new_value: JSON.stringify(lines) },
      { field_name: "proposedEndAt", previous_value: "2027-03-02T18:00:00.000Z", new_value: "2027-03-02T18:30:00.000Z" },
      { field_name: "venueRequirements", previous_value: '{"minCapacity":100}', new_value: null },
    ]);
  });

  describe("the schedule-changed message (EN-11)", () => {
    const actor = { userId: COORDINATOR, role: "EVENT_COORDINATOR" };

    async function scheduleMessages(id: string) {
      return sql<{ envelope: Record<string, unknown> }[]>`
        select envelope from event.outbox where message_key = ${id} and envelope->>'type' = 'event.schedule-changed'`;
    }

    it("writes one when the change moves the end, with the previous and new dates and the event's status", async () => {
      const end = new Date("2027-03-02T18:00:00.000Z");
      const id = await seedEvent(sql, { ownerId: OWNER, status: "CONFIRMED", endsAt: end });
      const current = { proposedEndAt: end.toISOString() } as unknown as ChangeableEvent;

      await sql.begin((tx) => applyApprovedChange(tx, { id, current }, { proposedEndAt: "2027-03-02T20:00:00.000Z" }, actor));

      const [row, ...rest] = await scheduleMessages(id);
      expect(rest).toHaveLength(0);
      expect(row!.envelope.actor).toBe(`EVENT_COORDINATOR:${COORDINATOR}`);
      expect(row!.envelope.data).toEqual({
        eventId: id,
        ownerId: OWNER,
        status: "CONFIRMED",
        previousStartAt: "2027-03-02T14:00:00.000Z",
        previousEndAt: "2027-03-02T18:00:00.000Z",
        proposedStartAt: "2027-03-02T14:00:00.000Z",
        proposedEndAt: "2027-03-02T20:00:00.000Z",
        changedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T.*Z$/),
      });
    });

    it("writes one when only the start moves", async () => {
      const id = await seedEvent(sql, { ownerId: OWNER, status: "PLANNING", endsAt: new Date("2027-03-02T18:00:00.000Z") });
      const current = { proposedStartAt: "2027-03-02T14:00:00.000Z" } as unknown as ChangeableEvent;

      await sql.begin((tx) => applyApprovedChange(tx, { id, current }, { proposedStartAt: "2027-03-02T15:00:00.000Z" }, actor));

      const [row] = await scheduleMessages(id);
      expect(row!.envelope.data).toMatchObject({ status: "PLANNING", proposedStartAt: "2027-03-02T15:00:00.000Z" });
    });

    it("writes none when the dates it sets are the ones the event already has", async () => {
      const end = new Date("2027-03-02T18:00:00.000Z");
      const id = await seedEvent(sql, { ownerId: OWNER, status: "CONFIRMED", endsAt: end });
      const current = { proposedEndAt: end.toISOString(), expectedAttendance: 150 } as unknown as ChangeableEvent;

      // The same instant written with another offset.
      await sql.begin((tx) =>
        applyApprovedChange(tx, { id, current }, { expectedAttendance: 200, proposedEndAt: "2027-03-03T02:00:00+08:00" }, actor)
      );

      expect(await scheduleMessages(id)).toHaveLength(0);
    });

    it("writes none when the change touches no date", async () => {
      const id = await seedEvent(sql, { ownerId: OWNER, status: "CONFIRMED", endsAt: new Date("2027-03-02T18:00:00.000Z") });
      const current = { expectedAttendance: 150 } as unknown as ChangeableEvent;

      await sql.begin((tx) => applyApprovedChange(tx, { id, current }, { expectedAttendance: 200 }, actor));

      expect(await scheduleMessages(id)).toHaveLength(0);
    });
  });
});
