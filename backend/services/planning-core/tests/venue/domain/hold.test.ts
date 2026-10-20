import { describe, expect, it } from "vitest";
import {
  duplicateHoldMessage,
  eventHoldable,
  expiredMessage,
  formatInstant,
  formatPeriod,
  hasExpired,
  holdConflictMessage,
  isLiveHoldDuplicate,
  notHeldMessage,
  notHoldableMessage,
  notReleasableMessage,
  notRequestedMessage,
  readHoldRequest,
  readPlacement,
} from "../../../src/modules/venue/domain/hold.js";

/** L3 — a hold's rules: reading a request and a placement, and the refusals' wording. */

const EVENT = "11111111-1111-4111-8111-111111111111";
const VENUE = "22222222-2222-4222-8222-222222222222";

function request(overrides: Record<string, unknown> = {}) {
  return {
    eventId: EVENT,
    venueId: VENUE,
    startsAt: "2026-12-02T14:00+08:00",
    endsAt: "2026-12-02T18:00+08:00",
    reminderLeadMinutes: 1440,
    ...overrides,
  };
}

const fieldsOf = (result: ReturnType<typeof readHoldRequest> | ReturnType<typeof readPlacement>) =>
  result.ok ? [] : result.fields.map((f) => f.field);

describe("readHoldRequest (L3-T1, L3-T4)", () => {
  it("reads a valid request, with the period as UTC instants", () => {
    expect(readHoldRequest(request())).toEqual({
      ok: true,
      hold: {
        eventId: EVENT,
        venueId: VENUE,
        startsAt: "2026-12-02T06:00:00.000Z",
        endsAt: "2026-12-02T10:00:00.000Z",
        reminderLeadMinutes: 1440,
      },
    });
  });

  it("refuses a body that isn't an object", () => {
    for (const body of [null, "hold", [request()]]) {
      expect(readHoldRequest(body)).toEqual({ ok: false, fields: [{ field: "body", message: "Send the hold as a JSON object." }] });
    }
  });

  it("names every wrong field at once", () => {
    const result = readHoldRequest({ eventId: "x", venueId: 7, startsAt: "2 Dec", endsAt: "", reminderLeadMinutes: "1" });
    expect(fieldsOf(result)).toEqual(["eventId", "venueId", "startsAt", "endsAt", "reminderLeadMinutes"]);
  });

  it("refuses an end that isn't after the start, and a start without an offset", () => {
    expect(fieldsOf(readHoldRequest(request({ endsAt: "2026-12-02T14:00+08:00" })))).toEqual(["endsAt"]);
    expect(fieldsOf(readHoldRequest(request({ startsAt: "2026-12-02T14:00" })))).toEqual(["startsAt"]);
  });

  it("refuses a reminder of 0 minutes and accepts 1 (boundary)", () => {
    const zero = readHoldRequest(request({ reminderLeadMinutes: 0 }));
    expect(zero).toEqual({
      ok: false,
      fields: [{ field: "reminderLeadMinutes", message: "Enter a whole number of minutes, at least 1." }],
    });
    expect(readHoldRequest(request({ reminderLeadMinutes: 1 })).ok).toBe(true);
  });

  it("refuses a fractional or missing reminder", () => {
    expect(fieldsOf(readHoldRequest(request({ reminderLeadMinutes: 1.5 })))).toEqual(["reminderLeadMinutes"]);
    expect(fieldsOf(readHoldRequest(request({ reminderLeadMinutes: undefined })))).toEqual(["reminderLeadMinutes"]);
  });
});

describe("readPlacement (L3-T6)", () => {
  const now = new Date("2026-10-19T07:00:00.000Z");

  it("accepts an expiry a minute after now, as a UTC instant", () => {
    expect(readPlacement({ expiresAt: "2026-10-19T15:01+08:00" }, now)).toEqual({ ok: true, expiresAt: "2026-10-19T07:01:00.000Z" });
  });

  it("refuses an expiry exactly now or before (boundary)", () => {
    for (const expiresAt of ["2026-10-19T15:00+08:00", "2026-10-19T14:59+08:00"]) {
      expect(readPlacement({ expiresAt }, now)).toEqual({
        ok: false,
        fields: [{ field: "expiresAt", message: "The expiry must be later than now." }],
      });
    }
  });

  it("asks for the expiry when it is missing, and for an offset when it is malformed", () => {
    expect(readPlacement({}, now)).toEqual({ ok: false, fields: [{ field: "expiresAt", message: "Enter the expiry date and time." }] });
    expect(readPlacement(null, now)).toEqual({ ok: false, fields: [{ field: "expiresAt", message: "Enter the expiry date and time." }] });
    expect(readPlacement({ expiresAt: "2026-12-01 18:00" }, now)).toEqual({
      ok: false,
      fields: [{ field: "expiresAt", message: "Enter a date and time with its offset, for example 2026-12-02T14:00+08:00." }],
    });
  });
});

describe("which events can be held (L3-T3)", () => {
  it("refuses Completed, Cancelled and Rejected events, naming the status", () => {
    for (const status of ["COMPLETED", "CANCELLED", "REJECTED"] as const) expect(eventHoldable(status)).toBe(false);
    expect(notHoldableMessage("CANCELLED")).toBe("A venue can't be held for an event that is Cancelled.");
  });

  it("allows every other status", () => {
    for (const status of ["UNDER_REVIEW", "APPROVED", "PLANNING", "SAFETY_REVIEW", "CONFIRMED"] as const) {
      expect(eventHoldable(status)).toBe(true);
    }
  });
});

describe("refusals (L3-T8, L3-T11, L3-T13, L3-T15)", () => {
  it("names the overlapped hold or booking with its period, in Singapore time (L3-T8)", () => {
    expect(
      holdConflictMessage([{ reference: "HLD-000001", startsAt: "2026-12-02T06:00:00.000Z", endsAt: "2026-12-02T10:00:00.000Z" }], "Lee Kong Chian Auditorium"),
    ).toBe(
      "This period overlaps HLD-000001 (Wednesday 2 December 2026, 14:00–18:00) at Lee Kong Chian Auditorium. A held or booked period can't be taken by another event.",
    );
  });

  it("lists several overlaps, and says so when the other was released since", () => {
    const two = holdConflictMessage(
      [
        { reference: "HLD-000001", startsAt: "2026-12-02T02:00:00.000Z", endsAt: "2026-12-02T04:00:00.000Z" },
        { reference: "BKR-000002", startsAt: "2026-12-02T06:00:00.000Z", endsAt: "2026-12-02T10:00:00.000Z" },
      ],
      "Hall",
    );
    expect(two).toContain("HLD-000001 (Wednesday 2 December 2026, 10:00–12:00) and BKR-000002 (Wednesday 2 December 2026, 14:00–18:00)");
    expect(holdConflictMessage([], "Hall")).toContain("overlaps another hold or booking at Hall");
  });

  it("names the event's existing hold (L3-T11)", () => {
    expect(duplicateHoldMessage("HLD-000001", "Lee Kong Chian Auditorium")).toBe(
      "This event already has hold HLD-000001 at Lee Kong Chian Auditorium. Release it, or convert it into a booking request, before holding the venue again.",
    );
  });

  it("says why a hold can't be placed, converted or released", () => {
    expect(notRequestedMessage("HLD-000001", "HELD")).toBe("HLD-000001 is Held, so it can't be placed. Only a requested hold can be.");
    expect(notHeldMessage("HLD-000001", "REQUESTED")).toBe(
      "HLD-000001 is Requested, so it can't be converted. Only a hold Venue Staff have placed can be.",
    );
    expect(notReleasableMessage("HLD-000001", "CONVERTED")).toBe(
      "HLD-000001 is Converted, so it can't be released. Only a requested or held hold can be.",
    );
    expect(expiredMessage("HLD-000001", "2026-12-01T10:00:00.000Z")).toBe(
      "HLD-000001 expired on Tuesday 1 December 2026, 18:00, so it can't be converted. Ask for a new hold.",
    );
  });
});

describe("expiry (L3-T13, ahead of L6)", () => {
  it("has expired at the expiry instant, not a millisecond before", () => {
    const expiresAt = "2026-12-01T10:00:00.000Z";
    expect(hasExpired(expiresAt, new Date("2026-12-01T09:59:59.999Z"))).toBe(false);
    expect(hasExpired(expiresAt, new Date(expiresAt))).toBe(true);
  });
});

describe("formatting", () => {
  it("shows Singapore time, with a period's end as 24:00 at midnight", () => {
    expect(formatInstant("2026-12-01T10:00:00.000Z")).toBe("Tuesday 1 December 2026, 18:00");
    expect(formatPeriod("2026-12-02T14:00:00.000Z", "2026-12-02T16:00:00.000Z")).toBe("Wednesday 2 December 2026, 22:00–24:00");
  });
});

describe("isLiveHoldDuplicate", () => {
  it("recognises only the one-live-hold index refusing an insert", () => {
    expect(isLiveHoldDuplicate({ code: "23505", constraint_name: "holds_one_live_per_event_and_venue" })).toBe(true);
    expect(isLiveHoldDuplicate({ code: "23505", constraint_name: "holds_reference_key" })).toBe(false);
    expect(isLiveHoldDuplicate({ code: "23P01", constraint_name: "holds_one_live_per_event_and_venue" })).toBe(false);
    expect(isLiveHoldDuplicate(null)).toBe(false);
    expect(isLiveHoldDuplicate("error")).toBe(false);
  });
});
