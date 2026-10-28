import { describe, expect, it } from "vitest";
import { BOOKING_REQUEST_STATUSES, BOOKING_REQUEST_STATUS_LABELS, SUITABILITY_STATUSES } from "../src/venueBooking.js";
import { parseCloudEvent } from "../src/cloudEvent.js";
import { ERROR_CODES } from "../src/errorCodes.js";

/** L1, L2 — a venue booking request's statuses, its messages, and its refusals. */

describe("BOOKING_REQUEST_STATUSES", () => {
  it("are Pending, Approved, Rejected and Withdrawn, each with a label", () => {
    expect(BOOKING_REQUEST_STATUSES).toEqual(["PENDING", "APPROVED", "REJECTED", "WITHDRAWN"]);
    expect(BOOKING_REQUEST_STATUS_LABELS).toEqual({
      PENDING: "Pending",
      APPROVED: "Approved",
      REJECTED: "Rejected",
      WITHDRAWN: "Withdrawn",
    });
  });
});

describe("SUITABILITY_STATUSES (K1, K2)", () => {
  it("are Suitable, Suitable with warnings and Not suitable", () => {
    expect(SUITABILITY_STATUSES).toEqual(["SUITABLE", "SUITABLE_WITH_WARNINGS", "NOT_SUITABLE"]);
  });
});

describe("venue-booking.request-submitted", () => {
  const data = {
    bookingRequestId: "11111111-1111-4111-8111-111111111111",
    reference: "BKR-000001",
    eventId: "22222222-2222-4222-8222-222222222222",
    eventReference: "EVT-000123",
    eventName: "Annual Research Symposium",
    venueId: "33333333-3333-4333-8333-333333333333",
    venueName: "Lee Kong Chian Auditorium",
    startsAt: "2026-12-02T06:00:00.000Z",
    endsAt: "2026-12-02T10:00:00.000Z",
    staffIds: ["00000000-0000-0000-0000-000000000003"],
    requestedBy: "00000000-0000-0000-0000-000000000002",
    requestedAt: "2026-10-17T02:00:00.000Z",
  };
  const message = (payload: Record<string, unknown>) => ({
    specversion: "1.0",
    id: "44444444-4444-4444-8444-444444444444",
    source: "/connectsphere/planning-core/venue",
    type: "venue-booking.request-submitted",
    subject: data.bookingRequestId,
    time: "2026-10-17T02:00:00.000Z",
    datacontenttype: "application/json",
    traceparent: "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01",
    actor: "EVENT_COORDINATOR:00000000-0000-0000-0000-000000000002",
    data: payload,
  });

  it("accepts a submitted request naming the venue's staff, and returns its data (L1-T7)", () => {
    const parsed = parseCloudEvent(message(data));
    expect(parsed.type).toBe("venue-booking.request-submitted");
    expect(parsed.data).toEqual(data);
  });

  it("refuses a message without the staff to notify, or with none", () => {
    const rest: Record<string, unknown> = { ...data };
    delete rest.staffIds;
    expect(() => parseCloudEvent(message(rest))).toThrow(/staffIds/);
    expect(() => parseCloudEvent(message({ ...data, staffIds: [] }))).toThrow(/staffIds/);
  });

  it("refuses a reference that isn't BKR- and six digits", () => {
    expect(() => parseCloudEvent(message({ ...data, reference: "BKR-1" }))).toThrow(/reference/);
  });
});

describe("venue-booking.request-approved and venue-booking.request-rejected (M1, M2)", () => {
  const decided = {
    bookingRequestId: "11111111-1111-4111-8111-111111111111",
    reference: "BKR-000001",
    eventId: "22222222-2222-4222-8222-222222222222",
    eventReference: "EVT-000123",
    eventName: "Annual Research Symposium",
    venueId: "33333333-3333-4333-8333-333333333333",
    venueName: "Lee Kong Chian Auditorium",
    startsAt: "2026-12-02T06:00:00.000Z",
    endsAt: "2026-12-02T10:00:00.000Z",
    coordinatorId: "00000000-0000-0000-0000-000000000002",
    ownerId: "00000000-0000-0000-0000-000000000001",
    decidedBy: "00000000-0000-0000-0000-000000000003",
    decidedAt: "2026-10-18T02:00:00.000Z",
  };
  const approved = { ...decided, bookingId: "55555555-5555-4555-8555-555555555555", replacedBookingId: null };
  const rejected = { ...decided, reason: "Closed for exams that week", suggestion: "Seminar Room 2-1" };
  const message = (type: string, payload: Record<string, unknown>) => ({
    specversion: "1.0",
    id: "44444444-4444-4444-8444-444444444444",
    source: "/connectsphere/planning-core/venue",
    type,
    subject: decided.bookingRequestId,
    time: "2026-10-18T02:00:00.000Z",
    datacontenttype: "application/json",
    traceparent: "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01",
    actor: "VENUE_STAFF:00000000-0000-0000-0000-000000000003",
    data: payload,
  });

  it("accepts an approval naming the coordinator, the owner and the new booking (M1-T8)", () => {
    expect(parseCloudEvent(message("venue-booking.request-approved", approved)).data).toEqual(approved);
    const replacing = { ...approved, replacedBookingId: "66666666-6666-4666-8666-666666666666" };
    expect(parseCloudEvent(message("venue-booking.request-approved", replacing)).data).toEqual(replacing);
  });

  it("accepts a rejection with its reason, and with or without a suggested alternative (M2-T5)", () => {
    expect(parseCloudEvent(message("venue-booking.request-rejected", rejected)).data).toEqual(rejected);
    const bare = { ...rejected, suggestion: null };
    expect(parseCloudEvent(message("venue-booking.request-rejected", bare)).data).toEqual(bare);
  });

  it("refuses a decision without the people to notify", () => {
    for (const field of ["coordinatorId", "ownerId"]) {
      const rest: Record<string, unknown> = { ...approved };
      delete rest[field];
      expect(() => parseCloudEvent(message("venue-booking.request-approved", rest)), field).toThrow(new RegExp(field));
    }
  });

  it("refuses an approval without its booking, and a rejection without a reason (M2-T1)", () => {
    const noBooking: Record<string, unknown> = { ...approved };
    delete noBooking.bookingId;
    expect(() => parseCloudEvent(message("venue-booking.request-approved", noBooking))).toThrow(/bookingId/);
    expect(() => parseCloudEvent(message("venue-booking.request-rejected", { ...rejected, reason: "   " }))).toThrow(/reason/);
  });
});

describe("venue-booking.booking-disrupted and venue-booking.disruption-cleared (I2)", () => {
  const disrupted = {
    blockId: "77777777-7777-4777-8777-777777777777",
    venueId: "33333333-3333-4333-8333-333333333333",
    venueName: "Lee Kong Chian Auditorium",
    kind: "BOOKING",
    reference: "BKR-000001",
    eventId: "22222222-2222-4222-8222-222222222222",
    eventReference: "EVT-000123",
    eventName: "Annual Research Symposium",
    coordinatorId: "00000000-0000-0000-0000-000000000002",
    blockStartsAt: "2026-12-02T08:00:00.000Z",
    blockEndsAt: "2026-12-02T11:00:00.000Z",
    reasonType: "MAINTENANCE",
    description: "Stage rigging inspection",
    actedBy: "00000000-0000-0000-0000-000000000003",
    actedAt: "2026-10-19T02:00:00.000Z",
  };
  const cleared = { ...disrupted, stillDisrupted: false };
  const message = (type: string, payload: Record<string, unknown>) => ({
    specversion: "1.0",
    id: "44444444-4444-4444-8444-444444444444",
    source: "/connectsphere/planning-core/venue",
    type,
    subject: disrupted.blockId,
    time: "2026-10-19T02:00:00.000Z",
    datacontenttype: "application/json",
    traceparent: "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01",
    actor: "VENUE_STAFF:00000000-0000-0000-0000-000000000003",
    data: payload,
  });

  it("accepts a disrupted booking, hold or request, naming the coordinator to tell (I2-T8, I2-T9)", () => {
    for (const kind of ["BOOKING", "HOLD", "REQUEST"]) {
      const data = { ...disrupted, kind };
      expect(parseCloudEvent(message("venue-booking.booking-disrupted", data)).data, kind).toEqual(data);
    }
  });

  it("accepts a block with no end, carrying a null end, but not a missing or malformed one (I5-T8)", () => {
    for (const type of ["venue-booking.booking-disrupted", "venue-booking.disruption-cleared"]) {
      const data = { ...(type.endsWith("cleared") ? cleared : disrupted), blockEndsAt: null };
      expect(parseCloudEvent(message(type, data)).data, type).toEqual(data);
      const noEnd: Record<string, unknown> = { ...data };
      delete noEnd.blockEndsAt;
      expect(() => parseCloudEvent(message(type, noEnd)), type).toThrow(/blockEndsAt/);
      expect(() => parseCloudEvent(message(type, { ...data, blockEndsAt: "later" })), type).toThrow(/blockEndsAt/);
    }
  });

  it("accepts a cleared disruption, saying whether another block still disrupts it (I2-T11)", () => {
    expect(parseCloudEvent(message("venue-booking.disruption-cleared", cleared)).data).toEqual(cleared);
    expect(() => parseCloudEvent(message("venue-booking.disruption-cleared", disrupted))).toThrow(/stillDisrupted/);
  });

  it("says why a flag stays, when it does: another block, or the venue's setup and turnaround time (H3-T14)", () => {
    for (const stillCause of ["UNAVAILABILITY", "BUFFER_CONFLICT", null] as const) {
      const still = { ...cleared, stillDisrupted: stillCause !== null, stillCause };
      expect(parseCloudEvent(message("venue-booking.disruption-cleared", still)).data).toEqual(still);
    }
    expect(() => parseCloudEvent(message("venue-booking.disruption-cleared", { ...cleared, stillCause: "HOLD" }))).toThrow(/stillCause/);
  });

  it("refuses an unknown kind or reason type, and a message without the coordinator", () => {
    expect(() => parseCloudEvent(message("venue-booking.booking-disrupted", { ...disrupted, kind: "EVENT" }))).toThrow(/kind/);
    expect(() => parseCloudEvent(message("venue-booking.booking-disrupted", { ...disrupted, reasonType: "FLOOD" }))).toThrow(/reasonType/);
    const rest: Record<string, unknown> = { ...disrupted };
    delete rest.coordinatorId;
    expect(() => parseCloudEvent(message("venue-booking.booking-disrupted", rest))).toThrow(/coordinatorId/);
  });
});

describe("L6: hold expiry messages", () => {
  const ids = {
    holdId: "11111111-1111-4111-8111-111111111111",
    venueId: "33333333-3333-4333-8333-333333333333",
    eventId: "22222222-2222-4222-8222-222222222222",
    coordinatorId: "00000000-0000-0000-0000-000000000002",
  };
  const placed = {
    holdId: ids.holdId,
    holdReference: "HLD-000001",
    venueId: ids.venueId,
    eventId: ids.eventId,
    expiresAt: "2026-12-01T06:00:00.000Z",
    reminderLeadMinutes: 60,
  };
  const changed = {
    holdId: ids.holdId,
    holdReference: "HLD-000001",
    venueId: ids.venueId,
    expiresAt: "2026-12-02T06:00:00.000Z",
    reminderLeadMinutes: 60,
    changedBy: "00000000-0000-0000-0000-000000000003",
  };
  const notice = {
    holdId: ids.holdId,
    holdReference: "HLD-000001",
    venueId: ids.venueId,
    venueName: "Lee Kong Chian Auditorium",
    eventId: ids.eventId,
    eventReference: "EVT-000123",
    eventName: "Annual Research Symposium",
    coordinatorId: ids.coordinatorId,
    startsAt: "2026-12-02T02:00:00.000Z",
    endsAt: "2026-12-02T04:00:00.000Z",
    expiresAt: "2026-12-01T06:00:00.000Z",
  };
  const message = (type: string, data: Record<string, unknown>) => ({
    specversion: "1.0",
    id: "44444444-4444-4444-8444-444444444444",
    source: "/connectsphere/planning-core/venue",
    type,
    subject: ids.holdId,
    time: "2026-10-21T02:00:00.000Z",
    datacontenttype: "application/json",
    traceparent: "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01",
    actor: "VENUE_STAFF:00000000-0000-0000-0000-000000000003",
    data,
  });
  const cases: Array<[string, Record<string, unknown>]> = [
    ["venue-booking.hold-placed", placed],
    ["venue-booking.hold-expiry-changed", changed],
    ["venue-booking.hold-expiring", notice],
    ["venue-booking.hold-expired", notice],
  ];

  it.each(cases)("accepts a valid %s and returns its data", (type, data) => {
    expect(parseCloudEvent(message(type, data)).data).toEqual(data);
  });

  it.each(cases)("refuses %s with any field missing", (type, data) => {
    for (const field of Object.keys(data)) {
      const rest = { ...data };
      delete rest[field];
      expect(() => parseCloudEvent(message(type, rest)), `${type} without ${field}`).toThrow(new RegExp(field));
    }
  });

  it("refuses a reminder lead under one minute", () => {
    expect(() => parseCloudEvent(message("venue-booking.hold-placed", { ...placed, reminderLeadMinutes: 0 }))).toThrow(
      /reminderLeadMinutes/,
    );
  });
});

describe("venue-booking.buffer-conflict-flagged (H3)", () => {
  const flagged = {
    venueId: "33333333-3333-4333-8333-333333333333",
    venueName: "Lee Kong Chian Auditorium",
    kind: "BOOKING",
    reference: "BKR-000001",
    eventId: "22222222-2222-4222-8222-222222222222",
    eventReference: "EVT-000123",
    eventName: "Annual Research Symposium",
    coordinatorId: "00000000-0000-0000-0000-000000000002",
    overlapsReferences: ["BKR-000002"],
    setupMinutes: 0,
    turnaroundMinutes: 30,
    actedBy: "00000000-0000-0000-0000-000000000003",
    actedAt: "2026-10-20T02:00:00.000Z",
  };
  const message = (payload: Record<string, unknown>) => ({
    specversion: "1.0",
    id: "44444444-4444-4444-8444-444444444444",
    source: "/connectsphere/planning-core/venue",
    type: "venue-booking.buffer-conflict-flagged",
    subject: flagged.venueId,
    time: "2026-10-20T02:00:00.000Z",
    datacontenttype: "application/json",
    traceparent: "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01",
    actor: "VENUE_STAFF:00000000-0000-0000-0000-000000000003",
    data: payload,
  });

  it("accepts a booking or hold the venue's new times make overlap others, naming them and the coordinator (H3-T10)", () => {
    expect(parseCloudEvent(message(flagged)).data).toEqual(flagged);
    expect(parseCloudEvent(message({ ...flagged, kind: "HOLD" })).data).toMatchObject({ kind: "HOLD" });
  });

  it("accepts a pending request the venue's new times make overlap others, naming its requesting coordinator (H3-T11)", () => {
    expect(parseCloudEvent(message({ ...flagged, kind: "REQUEST" })).data).toMatchObject({ kind: "REQUEST" });
  });

  it("refuses one that names nothing it overlaps, an unknown kind, or times that aren't whole minutes from 0", () => {
    expect(() => parseCloudEvent(message({ ...flagged, overlapsReferences: [] }))).toThrow(/overlapsReferences/);
    expect(() => parseCloudEvent(message({ ...flagged, kind: "BLOCK" }))).toThrow(/kind/);
    expect(() => parseCloudEvent(message({ ...flagged, turnaroundMinutes: -1 }))).toThrow(/turnaroundMinutes/);
    expect(() => parseCloudEvent(message({ ...flagged, setupMinutes: 1.5 }))).toThrow(/setupMinutes/);
  });
});

describe("ERROR_CODES", () => {
  it("has M1's refusal by recorded unavailability", () => {
    expect(ERROR_CODES).toContain("VENUE_UNAVAILABLE");
  });

  it("has I2's refusals for a block that doesn't exist or was already removed", () => {
    expect(ERROR_CODES).toContain("BLOCK_NOT_FOUND");
    expect(ERROR_CODES).toContain("BLOCK_ALREADY_REMOVED");
  });

  it("has L1 and L2's refusals", () => {
    for (const code of [
      "EVENT_NOT_BOOKABLE",
      "VENUE_INACTIVE",
      "BOOKING_REQUEST_DUPLICATE",
      "BOOKING_REQUEST_NOT_FOUND",
      "BOOKING_REQUEST_NOT_PENDING",
      "REPLACEMENT_NOT_VALID",
    ]) {
      expect(ERROR_CODES, code).toContain(code);
    }
  });

  it("has K2's refusal of an unsuitable venue without a justification", () => {
    expect(ERROR_CODES).toContain("JUSTIFICATION_REQUIRED");
  });
});
