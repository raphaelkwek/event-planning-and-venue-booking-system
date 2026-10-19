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

describe("ERROR_CODES", () => {
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
