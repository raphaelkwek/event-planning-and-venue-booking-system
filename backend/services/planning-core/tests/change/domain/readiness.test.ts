import { describe, expect, it } from "vitest";
import {
  ARRANGEMENTS_UNAVAILABLE_MESSAGE,
  NOT_ASSIGNED_MESSAGE,
  assessReadiness,
  equipmentOutstanding,
  flagsOutstanding,
  isReservedInFull,
  refusalMessage,
  venueOutstanding,
  type ReadinessBooking,
  type ReadinessInput,
  type ReadinessLine,
  type ReadinessRequest,
} from "../../../src/modules/change/domain/readiness.js";

// F5 — the readiness rules, which need no database. The API cards (tests/F5,
// f5Cards.test.ts) check the same rules end to end.

const confirmed = (reference = "BKR-000001", venueName = "F5 Hall"): ReadinessBooking => ({
  reference,
  venueName,
  status: "CONFIRMED",
  flags: [],
});
const held = (reference = "HLD-1", venueName = "F5 Hall"): ReadinessBooking => ({ reference, venueName, status: "HELD", flags: [] });
const pending = (reference = "BKR-000002", venueName = "F5 Breakout Room"): ReadinessRequest => ({ reference, venueName, flags: [] });
const line = (overrides: Partial<ReadinessLine> = {}): ReadinessLine => ({
  id: "line-1",
  equipmentTypeName: "F5 Chairs",
  quantity: 5,
  status: "RESERVED",
  reservation: { requestedQuantity: 5, reservedQuantity: 5 },
  ...overrides,
});
const ready = (overrides: Partial<ReadinessInput> = {}): ReadinessInput => ({
  equipmentRequired: true,
  bookings: [confirmed()],
  requests: [],
  lines: [line()],
  ...overrides,
});

describe("venueOutstanding (AC2, CQ-05 as AC2 reads)", () => {
  it("is satisfied by one confirmed booking", () => {
    expect(venueOutstanding([confirmed()], [])).toEqual([]);
  });

  it("is satisfied by several confirmed bookings (L4)", () => {
    expect(venueOutstanding([confirmed("BKR-000001"), confirmed("BKR-000003", "F5 Breakout Room")], [])).toEqual([]);
  });

  it("names the missing confirmed booking when there is no arrangement at all", () => {
    expect(venueOutstanding([], [])).toEqual([{ kind: "NO_CONFIRMED_BOOKING" }]);
  });

  it("does not take a tentative hold for a booking (L3)", () => {
    expect(venueOutstanding([held()], [])).toEqual([
      { kind: "NO_CONFIRMED_BOOKING" },
      { kind: "HOLD", reference: "HLD-1", venueName: "F5 Hall" },
    ]);
  });

  it("refuses a hold or a pending request beside a confirmed booking: every active one must be confirmed", () => {
    expect(venueOutstanding([confirmed(), held("HLD-2", "F5 Annex")], [pending()])).toEqual([
      { kind: "HOLD", reference: "HLD-2", venueName: "F5 Annex" },
      { kind: "PENDING_REQUEST", reference: "BKR-000002", venueName: "F5 Breakout Room" },
    ]);
  });

  it("does not take a pending request for a booking", () => {
    expect(venueOutstanding([], [pending()])).toEqual([
      { kind: "NO_CONFIRMED_BOOKING" },
      { kind: "PENDING_REQUEST", reference: "BKR-000002", venueName: "F5 Breakout Room" },
    ]);
  });
});

describe("isReservedInFull (AC3)", () => {
  it("is true for a Reserved line whose reservation holds the whole quantity (exactly at)", () => {
    expect(isReservedInFull(line())).toBe(true);
  });

  it("is false one below the requested quantity (just below)", () => {
    expect(isReservedInFull(line({ reservation: { requestedQuantity: 5, reservedQuantity: 4 } }))).toBe(false);
  });

  it("is false for a line that is not Reserved, even with a full reservation on record", () => {
    expect(isReservedInFull(line({ status: "CONFIRMED" }))).toBe(false);
  });

  it("is false for a Reserved line with no active reservation", () => {
    expect(isReservedInFull(line({ reservation: null }))).toBe(false);
  });
});

describe("equipmentOutstanding (AC3)", () => {
  it("counts an event marked as needing no equipment as complete, with or without lines", () => {
    expect(equipmentOutstanding(false, [])).toEqual([]);
    expect(equipmentOutstanding(false, [line({ status: "SUBMITTED", reservation: null })])).toEqual([]);
  });

  it("is not complete when equipment is required and nothing has been requested", () => {
    expect(equipmentOutstanding(true, [])).toEqual([{ kind: "NONE_REQUESTED" }]);
  });

  it("treats an unanswered equipment question as required", () => {
    expect(equipmentOutstanding(null, [])).toEqual([{ kind: "NONE_REQUESTED" }]);
  });

  it("is complete when every line is reserved in full", () => {
    expect(equipmentOutstanding(true, [line(), line({ id: "line-2", quantity: 2, reservation: { requestedQuantity: 2, reservedQuantity: 2 } })])).toEqual([]);
  });

  it("names each line not reserved in full, with its quantities, and only those", () => {
    expect(
      equipmentOutstanding(true, [
        line(),
        line({ id: "line-2", quantity: 2, status: "SUBMITTED", reservation: null }),
        line({ id: "line-3", reservation: { requestedQuantity: 5, reservedQuantity: 4 } }),
      ])
    ).toEqual([
      { kind: "LINE", lineId: "line-2", equipmentTypeName: "F5 Chairs", quantity: 2, status: "SUBMITTED", requestedQuantity: null, reservedQuantity: null },
      { kind: "LINE", lineId: "line-3", equipmentTypeName: "F5 Chairs", quantity: 5, status: "RESERVED", requestedQuantity: 5, reservedQuantity: 4 },
    ]);
  });
});

describe("flagsOutstanding (AC7)", () => {
  it("is empty when nothing carries a flag", () => {
    expect(flagsOutstanding(ready())).toEqual([]);
  });

  it("names each flag on a booking, a hold, a pending request and an equipment line", () => {
    expect(
      flagsOutstanding(
        ready({
          bookings: [
            { ...confirmed(), flags: ["REQUIRES_RECONFIRMATION", "UNSUITABLE"] },
            { ...held(), flags: ["REQUIRES_RECONFIRMATION"] },
          ],
          requests: [{ ...pending(), flags: ["REQUIRES_RECONFIRMATION"] }],
          lines: [line({ flags: ["FLAGGED_FOR_REVIEW"] })],
        })
      )
    ).toEqual([
      { arrangement: "BOOKING", reference: "BKR-000001", name: "F5 Hall", flag: "REQUIRES_RECONFIRMATION" },
      { arrangement: "BOOKING", reference: "BKR-000001", name: "F5 Hall", flag: "UNSUITABLE" },
      { arrangement: "HOLD", reference: "HLD-1", name: "F5 Hall", flag: "REQUIRES_RECONFIRMATION" },
      { arrangement: "BOOKING_REQUEST", reference: "BKR-000002", name: "F5 Breakout Room", flag: "REQUIRES_RECONFIRMATION" },
      { arrangement: "EQUIPMENT_LINE", reference: "line-1", name: "F5 Chairs × 5", flag: "FLAGGED_FOR_REVIEW" },
    ]);
  });
});

describe("refusalMessage (AC6, AC7)", () => {
  it("names only the venue when only the venue is outstanding", () => {
    expect(refusalMessage([{ kind: "NO_CONFIRMED_BOOKING" }], [], [])).toBe(
      "This event can't be confirmed yet. Venue: no venue booking is confirmed."
    );
  });

  it("names each venue item, separated by semicolons", () => {
    expect(
      refusalMessage(
        [
          { kind: "NO_CONFIRMED_BOOKING" },
          { kind: "HOLD", reference: "HLD-1", venueName: "F5 Hall" },
          { kind: "PENDING_REQUEST", reference: "BKR-000002", venueName: "F5 Breakout Room" },
        ],
        [],
        []
      )
    ).toBe(
      "This event can't be confirmed yet. Venue: no venue booking is confirmed; hold HLD-1 at F5 Hall is only a tentative hold; " +
        "booking request BKR-000002 at F5 Breakout Room is still pending."
    );
  });

  it("names each equipment line by status, by how much of it is reserved, or that none was requested", () => {
    const status = equipmentOutstanding(true, [line({ status: "CONFIRMED", reservation: null })]);
    const partial = equipmentOutstanding(true, [line({ id: "line-2", reservation: { requestedQuantity: 5, reservedQuantity: 4 } })]);
    expect(refusalMessage([], [...status, ...partial], [])).toBe(
      "This event can't be confirmed yet. Equipment: F5 Chairs × 5 is Confirmed; F5 Chairs × 5 has 4 of 5 reserved."
    );
    expect(refusalMessage([], [{ kind: "NONE_REQUESTED" }], [])).toBe(
      "This event can't be confirmed yet. Equipment: no equipment has been requested, and the event is not marked as needing none."
    );
  });

  it("names a line by its status when its reservation on record is full but the line is not Reserved", () => {
    const items = equipmentOutstanding(true, [line({ status: "CONFIRMED" })]);
    expect(refusalMessage([], items, [])).toBe("This event can't be confirmed yet. Equipment: F5 Chairs × 5 is Confirmed.");
  });

  it("names a Reserved line with no reservation on record by its status", () => {
    const items = equipmentOutstanding(true, [line({ reservation: null })]);
    expect(refusalMessage([], items, [])).toBe("This event can't be confirmed yet. Equipment: F5 Chairs × 5 is Reserved.");
  });

  it("names each flag with what it is on", () => {
    expect(
      refusalMessage([], [], [
        { arrangement: "BOOKING", reference: "BKR-000001", name: "F5 Hall", flag: "REQUIRES_RECONFIRMATION" },
        { arrangement: "BOOKING", reference: "BKR-000001", name: "F5 Hall", flag: "UNSUITABLE" },
        { arrangement: "HOLD", reference: "HLD-1", name: "F5 Hall", flag: "REQUIRES_RECONFIRMATION" },
        { arrangement: "BOOKING_REQUEST", reference: "BKR-000002", name: "F5 Breakout Room", flag: "REQUIRES_RECONFIRMATION" },
        { arrangement: "EQUIPMENT_LINE", reference: "line-1", name: "F5 Chairs × 5", flag: "FLAGGED_FOR_REVIEW" },
      ])
    ).toBe(
      "This event can't be confirmed yet. Outstanding flags: booking BKR-000001 at F5 Hall requires reconfirmation; " +
        "booking BKR-000001 at F5 Hall is flagged unsuitable; hold HLD-1 at F5 Hall requires reconfirmation; " +
        "booking request BKR-000002 at F5 Breakout Room requires reconfirmation; equipment F5 Chairs × 5 is flagged for review."
    );
  });

  it("names venue, equipment and flags together, in that order", () => {
    expect(
      refusalMessage(
        [{ kind: "NO_CONFIRMED_BOOKING" }],
        [{ kind: "NONE_REQUESTED" }],
        [{ arrangement: "HOLD", reference: "HLD-1", name: "F5 Hall", flag: "REQUIRES_RECONFIRMATION" }]
      )
    ).toBe(
      "This event can't be confirmed yet. Venue: no venue booking is confirmed. " +
        "Equipment: no equipment has been requested, and the event is not marked as needing none. " +
        "Outstanding flags: hold HLD-1 at F5 Hall requires reconfirmation."
    );
  });
});

describe("assessReadiness", () => {
  it("is ready when the venue is confirmed, the equipment reserved in full and nothing flagged", () => {
    expect(assessReadiness(ready())).toEqual({ ready: true });
  });

  it("is ready for an event needing no equipment", () => {
    expect(assessReadiness(ready({ equipmentRequired: false, lines: [] }))).toEqual({ ready: true });
  });

  it("is not ready while only the venue is outstanding", () => {
    expect(assessReadiness(ready({ bookings: [] }))).toEqual({
      ready: false,
      message: "This event can't be confirmed yet. Venue: no venue booking is confirmed.",
      venue: [{ kind: "NO_CONFIRMED_BOOKING" }],
      equipment: [],
      flags: [],
    });
  });

  it("is not ready while only the equipment is outstanding", () => {
    const result = assessReadiness(ready({ lines: [] }));
    expect(result).toMatchObject({ ready: false, venue: [], equipment: [{ kind: "NONE_REQUESTED" }], flags: [] });
  });

  it("is not ready while only a flag is outstanding", () => {
    const result = assessReadiness(ready({ bookings: [{ ...confirmed(), flags: ["REQUIRES_RECONFIRMATION"] }] }));
    expect(result).toEqual({
      ready: false,
      message: "This event can't be confirmed yet. Outstanding flags: booking BKR-000001 at F5 Hall requires reconfirmation.",
      venue: [],
      equipment: [],
      flags: [{ arrangement: "BOOKING", reference: "BKR-000001", name: "F5 Hall", flag: "REQUIRES_RECONFIRMATION" }],
    });
  });
});

describe("messages", () => {
  it("tells the coordinator nothing changed when the arrangements could not be read (AC5)", () => {
    expect(ARRANGEMENTS_UNAVAILABLE_MESSAGE).toBe(
      "The venue and equipment arrangements could not be checked, so the event was not confirmed. Nothing was changed. Try again."
    );
  });

  it("names who may confirm (AC1)", () => {
    expect(NOT_ASSIGNED_MESSAGE).toBe("Only the event's assigned coordinator can confirm its arrangements.");
  });
});
