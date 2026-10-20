import { describe, expect, it } from "vitest";
import {
  DUPLICATE_REQUEST_CONSTRAINT,
  differencesFromEvent,
  duplicateMessage,
  eventBookable,
  isAssignedCoordinator,
  isDuplicatePending,
  layoutAt,
  notBookableMessage,
  notPendingMessage,
  readBookingRequest,
} from "../../../src/modules/venue/domain/bookingRequest.js";

/** L1, L2 — a venue booking request's rules. Postgres decides overlaps (the exclusion constraint). */

const EVENT = "22222222-2222-4222-8222-222222222222";
const VENUE = "33333333-3333-4333-8333-333333333333";
const valid = {
  eventId: EVENT,
  venueId: VENUE,
  startsAt: "2026-12-02T14:00+08:00",
  endsAt: "2026-12-02T18:00+08:00",
  layout: " Theatre ",
  expectedAttendance: 150,
  facilities: ["Projector", " projector", "Wireless microphones", " "],
  accessibilityFeatures: ["Step-free access"],
};

describe("readBookingRequest", () => {
  it("refuses an id with anything before or after it, and a year beyond four digits", () => {
    for (const eventId of [`x${EVENT}`, `${EVENT}x`]) {
      expect(readBookingRequest({ ...valid, eventId }), eventId).toMatchObject({ ok: false, fields: [{ field: "eventId" }] });
    }
    expect(readBookingRequest({ ...valid, startsAt: "+012026-12-02T14:00+08:00" })).toMatchObject({
      ok: false,
      fields: [{ field: "startsAt" }],
    });
  });

  it("reads a whole request, trimmed, with repeats dropped and times in UTC (L1-T2)", () => {
    expect(readBookingRequest(valid)).toEqual({
      ok: true,
      request: {
        eventId: EVENT,
        venueId: VENUE,
        startsAt: "2026-12-02T06:00:00.000Z",
        endsAt: "2026-12-02T10:00:00.000Z",
        layout: "Theatre",
        expectedAttendance: 150,
        facilities: ["Projector", "Wireless microphones"],
        accessibilityFeatures: ["Step-free access"],
        replacesBookingId: null,
      },
    });
  });

  it("treats missing lists as empty, and reads a replacement link (L1-T10)", () => {
    const rest: Record<string, unknown> = { ...valid };
    delete rest.facilities;
    delete rest.accessibilityFeatures;
    const replaces = "44444444-4444-4444-8444-444444444444";
    expect(readBookingRequest({ ...rest, replacesBookingId: replaces })).toMatchObject({
      ok: true,
      request: { facilities: [], accessibilityFeatures: [], replacesBookingId: replaces },
    });
    expect(readBookingRequest({ ...valid, replacesBookingId: null })).toMatchObject({ ok: true, request: { replacesBookingId: null } });
  });

  it("refuses an end at or before the start, and attendance that isn't a whole number above zero, naming each (L1-T12)", () => {
    expect(readBookingRequest({ ...valid, endsAt: "2026-12-02T13:00+08:00", expectedAttendance: 0 })).toEqual({
      ok: false,
      fields: [
        { field: "endsAt", message: "The end must be after the start." },
        { field: "expectedAttendance", message: "Expected attendance must be a whole number greater than zero." },
      ],
    });
    expect(readBookingRequest({ ...valid, endsAt: valid.startsAt })).toMatchObject({ ok: false, fields: [{ field: "endsAt" }] });
    for (const expectedAttendance of [1.5, -3, "150", null]) {
      expect(readBookingRequest({ ...valid, expectedAttendance }), String(expectedAttendance)).toMatchObject({
        ok: false,
        fields: [{ field: "expectedAttendance" }],
      });
    }
    expect(readBookingRequest({ ...valid, expectedAttendance: 1 })).toMatchObject({ ok: true });
  });

  it("names every missing or malformed field", () => {
    expect(readBookingRequest({ eventId: "x", venueId: 3, startsAt: "2026-12-02T14:00", layout: "  ", facilities: "Projector", replacesBookingId: "x" })).toEqual({
      ok: false,
      fields: [
        { field: "eventId", message: "Choose the event." },
        { field: "venueId", message: "Choose a venue." },
        { field: "startsAt", message: "Enter a date and time with its offset, for example 2026-12-02T14:00+08:00." },
        { field: "endsAt", message: "Enter a date and time with its offset, for example 2026-12-02T14:00+08:00." },
        { field: "layout", message: "Choose a room layout." },
        { field: "expectedAttendance", message: "Expected attendance must be a whole number greater than zero." },
        { field: "facilities", message: "Must be a list of names." },
        { field: "replacesBookingId", message: "Must be the id of the booking to replace." },
      ],
    });
    expect(readBookingRequest({ ...valid, accessibilityFeatures: ["Hearing loop", 3] })).toEqual({
      ok: false,
      fields: [{ field: "accessibilityFeatures", message: "Must be a list of names." }],
    });
    expect(readBookingRequest({ ...valid, startsAt: "2026-13-02T14:00+08:00" })).toEqual({
      ok: false,
      fields: [{ field: "startsAt", message: "Enter a date and time with its offset, for example 2026-12-02T14:00+08:00." }],
    });
  });

  it("refuses ids, times and a layout sent as anything but a string, a list holding one included", () => {
    expect(
      readBookingRequest({ ...valid, eventId: [EVENT], venueId: [VENUE], startsAt: [valid.startsAt], layout: 3, replacesBookingId: [VENUE] }),
    ).toMatchObject({
      ok: false,
      fields: [{ field: "eventId" }, { field: "venueId" }, { field: "startsAt" }, { field: "layout" }, { field: "replacesBookingId" }],
    });
  });

  it("accepts times with seconds and fractions of a second, in any offset", () => {
    expect(readBookingRequest({ ...valid, startsAt: "2026-12-02T14:00:00+08:00", endsAt: "2026-12-02T10:00:00.25Z" })).toMatchObject({
      ok: true,
      request: { startsAt: "2026-12-02T06:00:00.000Z", endsAt: "2026-12-02T10:00:00.250Z" },
    });
    expect(readBookingRequest({ ...valid, endsAt: "2026-12-02T10:00:0Z" })).toMatchObject({ ok: false, fields: [{ field: "endsAt" }] });
    expect(readBookingRequest({ ...valid, endsAt: "2026-12-02T10:00:00.Z" })).toMatchObject({ ok: false, fields: [{ field: "endsAt" }] });
  });

  it("refuses a body that isn't an object", () => {
    for (const body of [null, "x", [valid]]) {
      expect(readBookingRequest(body)).toEqual({ ok: false, fields: [{ field: "body", message: "Send the request as a JSON object." }] });
    }
  });
});

describe("eventBookable and notBookableMessage", () => {
  it("allow Approved, Planning, Safety Review and Confirmed, and nothing else (L1-T13)", () => {
    expect(["APPROVED", "PLANNING", "SAFETY_REVIEW", "CONFIRMED"].every((s) => eventBookable(s as never))).toBe(true);
    for (const status of ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "AWAITING_CLARIFICATION", "REJECTED", "CANCELLED", "COMPLETED"]) {
      expect(eventBookable(status as never), status).toBe(false);
    }
  });

  it("names the event's status and when a venue can be requested", () => {
    expect(notBookableMessage("UNDER_REVIEW")).toBe(
      "A venue can be requested once the event is approved: while it is Approved, Planning, Safety Review or Confirmed. It is Under Review.",
    );
  });
});

describe("layoutAt", () => {
  const layouts = [
    { name: "Theatre", capacity: 300 },
    { name: "Classroom", capacity: 120 },
  ];

  it("finds the venue's layout ignoring case, in the venue's spelling (L1-T14)", () => {
    expect(layoutAt(layouts, "classroom")).toBe("Classroom");
    expect(layoutAt(layouts, "Boardroom")).toBeNull();
  });
});

describe("differencesFromEvent", () => {
  const event = { startsAt: "2026-12-02T06:00:00.000Z", endsAt: "2026-12-02T10:00:00.000Z", attendance: 150 };

  it("lists each value that differs from the event, with both (L1-T4)", () => {
    expect(differencesFromEvent(event, { startsAt: "2026-12-02T06:00:00.000Z", endsAt: "2026-12-02T11:00:00.000Z", expectedAttendance: 180 })).toEqual([
      { field: "endsAt", event: "2026-12-02T10:00:00.000Z", requested: "2026-12-02T11:00:00.000Z" },
      { field: "expectedAttendance", event: 150, requested: 180 },
    ]);
    expect(differencesFromEvent(event, { startsAt: "2026-12-02T05:00:00.000Z", endsAt: event.endsAt, expectedAttendance: 150 })).toEqual([
      { field: "startsAt", event: "2026-12-02T06:00:00.000Z", requested: "2026-12-02T05:00:00.000Z" },
    ]);
  });

  it("finds none when the request keeps the event's values (L1-T3)", () => {
    expect(differencesFromEvent(event, { startsAt: event.startsAt, endsAt: event.endsAt, expectedAttendance: 150 })).toEqual([]);
  });
});

describe("isAssignedCoordinator", () => {
  it("is true only for the event's assigned coordinator (L1-T11, L2-T2)", () => {
    expect(isAssignedCoordinator("c1", { assignedCoordinatorId: "c1" })).toBe(true);
    expect(isAssignedCoordinator("c2", { assignedCoordinatorId: "c1" })).toBe(false);
    expect(isAssignedCoordinator("c1", { assignedCoordinatorId: null })).toBe(false);
  });
});

describe("isDuplicatePending and duplicateMessage", () => {
  it("recognise only the duplicate-request constraint's refusal (L1-T8)", () => {
    expect(isDuplicatePending({ code: "23P01", constraint_name: "booking_request_no_duplicate_pending" })).toBe(true);
    expect(isDuplicatePending({ code: "23P01", constraint_name: DUPLICATE_REQUEST_CONSTRAINT })).toBe(true);
    expect(isDuplicatePending({ code: "23P01", constraint_name: "venue_slot_no_overlap" })).toBe(false);
    expect(isDuplicatePending({ code: "23505", constraint_name: DUPLICATE_REQUEST_CONSTRAINT })).toBe(false);
    expect(isDuplicatePending(null)).toBe(false);
    expect(isDuplicatePending("23P01")).toBe(false);
    expect(isDuplicatePending(undefined)).toBe(false);
  });

  it("names the existing pending request, or says there is one when it can't be named", () => {
    expect(duplicateMessage(["BKR-000001"])).toBe(
      "This event already has a pending request for this venue that overlaps this period: BKR-000001. Withdraw it, or choose a period that doesn't overlap it.",
    );
    expect(duplicateMessage(["BKR-000001", "BKR-000002"])).toContain("this period: BKR-000001 and BKR-000002.");
    expect(duplicateMessage(["BKR-000001", "BKR-000002", "BKR-000003"])).toContain("this period: BKR-000001, BKR-000002 and BKR-000003.");
    expect(duplicateMessage([])).toContain("overlaps this period: another pending request.");
  });
});

describe("notPendingMessage", () => {
  it("names the request's status and what can't be done to it (L2-T3, M1-T9, M2-T7)", () => {
    expect(notPendingMessage("BKR-000001", "APPROVED", "withdrawn")).toBe(
      "BKR-000001 is Approved, so it can't be withdrawn. Only a pending request can be.",
    );
    expect(notPendingMessage("BKR-000002", "WITHDRAWN", "withdrawn")).toContain("is Withdrawn");
    expect(notPendingMessage("BKR-000003", "REJECTED", "approved")).toBe(
      "BKR-000003 is Rejected, so it can't be approved. Only a pending request can be.",
    );
    expect(notPendingMessage("BKR-000004", "APPROVED", "rejected")).toBe(
      "BKR-000004 is Approved, so it can't be rejected. Only a pending request can be.",
    );
  });
});
