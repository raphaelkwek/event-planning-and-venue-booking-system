import { describe, expect, it } from "vitest";
import {
  NOT_VENUE_STAFF,
  readBlock,
  readPeriod,
  requestBlockedMessage,
} from "../../../src/modules/venue/domain/unavailability.js";

/** I2 — what a block needs, and how a request over one is refused. Postgres decides overlaps. */

const valid = {
  startsAt: "2026-12-09T09:00+08:00",
  endsAt: "2026-12-09T13:00+08:00",
  reasonType: "MAINTENANCE",
  description: "  Annual rigging inspection  ",
};

describe("readBlock (I2-T1, I2-T2, I2-T3)", () => {
  it("reads a whole block, trimmed, with times in UTC", () => {
    expect(readBlock(valid)).toEqual({
      ok: true,
      block: {
        startsAt: "2026-12-09T01:00:00.000Z",
        endsAt: "2026-12-09T05:00:00.000Z",
        reasonType: "MAINTENANCE",
        description: "Annual rigging inspection",
      },
    });
  });

  it("accepts each of CR-02's reason types", () => {
    for (const reasonType of ["MAINTENANCE", "EQUIPMENT_FAILURE", "RENOVATION", "SAFETY", "OTHER"]) {
      expect(readBlock({ ...valid, reasonType }).ok, reasonType).toBe(true);
    }
  });

  it("names every missing field", () => {
    expect(readBlock({})).toEqual({
      ok: false,
      fields: [
        { field: "startsAt", message: "Enter the start date and time." },
        { field: "endsAt", message: "Enter the end date and time." },
        { field: "reasonType", message: "Choose a reason type." },
        { field: "description", message: "Enter a description." },
      ],
    });
    expect(readBlock({ ...valid, description: "   ", reasonType: "FLOOD" })).toEqual({
      ok: false,
      fields: [
        { field: "reasonType", message: "Choose a reason type." },
        { field: "description", message: "Enter a description." },
      ],
    });
  });

  it("refuses an end at or before the start, saying so under the end", () => {
    const refused = { ok: false, fields: [{ field: "endsAt", message: "The end must be after the start." }] };
    expect(readBlock({ ...valid, endsAt: valid.startsAt })).toEqual(refused);
    expect(readBlock({ ...valid, endsAt: "2026-12-09T08:59+08:00" })).toEqual(refused);
    expect(readBlock({ ...valid, endsAt: "2026-12-09T09:01+08:00" }).ok).toBe(true);
  });

  it("refuses a time without its offset or with anything around it, and an impossible date", () => {
    for (const startsAt of ["2026-12-09T09:00", "x2026-12-09T09:00+08:00", "2026-13-09T09:00+08:00", 20261209]) {
      expect(readBlock({ ...valid, startsAt }), String(startsAt)).toMatchObject({ ok: false, fields: [{ field: "startsAt" }] });
    }
  });

  it("refuses a description over 1000 characters", () => {
    expect(readBlock({ ...valid, description: "x".repeat(1000) }).ok).toBe(true);
    expect(readBlock({ ...valid, description: "x".repeat(1001) })).toEqual({
      ok: false,
      fields: [{ field: "description", message: "Keep the description to 1000 characters or fewer." }],
    });
  });

  it("refuses a body that isn't an object", () => {
    for (const body of [null, "block", [], undefined]) {
      expect(readBlock(body)).toEqual({ ok: false, fields: [{ field: "body", message: "Send the block as a JSON object." }] });
    }
  });
});

describe("readPeriod (I2-T4)", () => {
  it("reads the period a review asks about, or names what's wrong with it", () => {
    expect(readPeriod({ startsAt: valid.startsAt, endsAt: valid.endsAt })).toEqual({
      ok: true,
      startsAt: "2026-12-09T01:00:00.000Z",
      endsAt: "2026-12-09T05:00:00.000Z",
    });
    expect(readPeriod({})).toEqual({
      ok: false,
      fields: [
        { field: "startsAt", message: "Enter the start date and time." },
        { field: "endsAt", message: "Enter the end date and time." },
      ],
    });
    expect(readPeriod({ startsAt: valid.endsAt, endsAt: valid.startsAt })).toEqual({
      ok: false,
      fields: [{ field: "endsAt", message: "The end must be after the start." }],
    });
  });
});

describe("requestBlockedMessage (I2-T10)", () => {
  it("names each block the requested period overlaps, with its reason and period", () => {
    expect(
      requestBlockedMessage("Lee Kong Chian Auditorium", [
        { reasonType: "MAINTENANCE", description: "Annual rigging inspection", startsAt: "2026-12-09T01:00:00.000Z", endsAt: "2026-12-09T05:00:00.000Z" },
      ]),
    ).toBe(
      "Lee Kong Chian Auditorium is unavailable for Maintenance, “Annual rigging inspection” (Wednesday 9 December 2026, 09:00–13:00), " +
        "so it can't be requested for this period. Choose another time or venue.",
    );
  });

  it("names several", () => {
    const message = requestBlockedMessage("Hall", [
      { reasonType: "SAFETY", description: "Fire drill", startsAt: "2026-12-09T01:00:00.000Z", endsAt: "2026-12-09T02:00:00.000Z" },
      { reasonType: "OTHER", description: "Exams", startsAt: "2026-12-09T03:00:00.000Z", endsAt: "2026-12-09T04:00:00.000Z" },
    ]);
    expect(message).toContain("Safety concern, “Fire drill” (Wednesday 9 December 2026, 09:00–10:00) and Other operational reason, “Exams” (");
  });
});

describe("holdBlockedMessage (I4-T1, I4-T2)", () => {
  const maintenance = { reasonType: "MAINTENANCE" as const, description: "Annual rigging inspection", startsAt: "2026-12-09T01:00:00.000Z", endsAt: "2026-12-09T05:00:00.000Z" };

  it("says a hold can't be requested over the block, naming its reason type, description and period", () => {
    expect(holdBlockedMessage("Lee Kong Chian Auditorium", [maintenance])).toBe(
      "Lee Kong Chian Auditorium is unavailable for Maintenance, “Annual rigging inspection” (Wednesday 9 December 2026, 09:00–13:00), " +
        "so a hold can't be requested for this period. Choose another time or venue.",
    );
  });

  it("says the named hold can't be placed, and stays Requested", () => {
    expect(holdBlockedMessage("Lee Kong Chian Auditorium", [maintenance], "HLD-000007")).toBe(
      "Lee Kong Chian Auditorium is unavailable for Maintenance, “Annual rigging inspection” (Wednesday 9 December 2026, 09:00–13:00), " +
        "so HLD-000007 can't be placed for this period. It stays Requested.",
    );
  });

  it("names several blocks", () => {
    const message = holdBlockedMessage("Hall", [
      { reasonType: "SAFETY", description: "Fire drill", startsAt: "2026-12-09T01:00:00.000Z", endsAt: "2026-12-09T02:00:00.000Z" },
      { reasonType: "OTHER", description: "Exams", startsAt: "2026-12-09T03:00:00.000Z", endsAt: "2026-12-09T04:00:00.000Z" },
    ]);
    expect(message).toContain("Safety concern, “Fire drill” (Wednesday 9 December 2026, 09:00–10:00) and Other operational reason, “Exams” (");
  });
});

describe("NOT_VENUE_STAFF (I2-T13)", () => {
  it("says only the venue's Venue Staff record or remove its unavailability", () => {
    expect(NOT_VENUE_STAFF).toBe("Only the venue's Venue Staff can record or remove its unavailability.");
  });
});
