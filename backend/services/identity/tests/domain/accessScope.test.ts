import { describe, expect, it } from "vitest";
import { resolveAccessScope } from "../../src/domain/accessScope.js";

const USER_ID = "11111111-0000-0000-0000-000000000001";

describe("resolveAccessScope", () => {
  it("scopes an Organiser's events list to events they own (AC1)", () => {
    expect(resolveAccessScope("EVENT_ORGANISER", USER_ID, "events")).toEqual({
      scopeType: "OWNED_BY_USER",
      userId: USER_ID,
    });
  });

  it("gives a Coordinator every event, not filtered by assignment (AC2)", () => {
    expect(resolveAccessScope("EVENT_COORDINATOR", USER_ID, "events")).toEqual({ scopeType: "ALL" });
  });

  it("scopes Venue Staff's venue bookings to their own venues (AC3)", () => {
    expect(resolveAccessScope("VENUE_STAFF", USER_ID, "venue_bookings")).toEqual({
      scopeType: "STAFF_OWNED_VENUES",
      staffUserId: USER_ID,
    });
  });

  it("scopes Tech Support's equipment requests to what they handle (AC4)", () => {
    expect(resolveAccessScope("TECH_SUPPORT_STAFF", USER_ID, "equipment_requests")).toEqual({
      scopeType: "STAFF_OWNED_EQUIPMENT",
      staffUserId: USER_ID,
    });
  });

  it("scopes an Attendee's events list to open-for-registration only (AC5)", () => {
    expect(resolveAccessScope("ATTENDEE", USER_ID, "events")).toEqual({
      scopeType: "PUBLISHED_OPEN_REGISTRATION",
    });
  });

  it("denies a role no access rule covers, rather than defaulting to ALL", () => {
    expect(resolveAccessScope("ATTENDEE", USER_ID, "venue_bookings")).toEqual({ scopeType: "NONE" });
    expect(resolveAccessScope("VENUE_STAFF", USER_ID, "events")).toEqual({ scopeType: "NONE" });
  });
});
