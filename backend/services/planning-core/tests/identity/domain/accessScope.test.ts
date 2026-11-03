import { describe, expect, it } from "vitest";
import { notInScopeMessage, resolveAccessScope } from "../../../src/modules/identity/domain/accessScope.js";

const USER_ID = "11111111-0000-0000-0000-000000000001";

describe("resolveAccessScope", () => {
  it("scopes an Organiser's events list to events they own (AC1)", () => {
    expect(resolveAccessScope("EVENT_ORGANISER", USER_ID, "events")).toEqual({
      scopeType: "OWNED_BY_USER",
      userId: USER_ID,
    });
  });

  // A3's AC2 gave a coordinator every event; A4 (CR-05) supersedes it.
  it("scopes a Coordinator's events to the ones assigned to them (A4)", () => {
    expect(resolveAccessScope("EVENT_COORDINATOR", USER_ID, "events")).toEqual({
      scopeType: "ASSIGNED_TO_USER",
      userId: USER_ID,
    });
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
    expect(resolveAccessScope("EVENT_COORDINATOR", USER_ID, "equipment_requests")).toEqual({ scopeType: "NONE" });
  });

  it("denies a resource it doesn't know, even though the type system forbids one", () => {
    // The route validates the name first, but a caller in another module could
    // pass any string at runtime; the safe answer is no access.
    expect(resolveAccessScope("EVENT_COORDINATOR", USER_ID, "invoices" as never)).toEqual({ scopeType: "NONE" });
  });
});

describe("resolveAccessScope for the Event Coordinator Lead (E5)", () => {
  it("gives the Lead every event, to oversee and assign", () => {
    expect(resolveAccessScope("EVENT_COORDINATOR_LEAD", USER_ID, "events")).toEqual({ scopeType: "ALL" });
  });

  it("gives the Lead no venue bookings or equipment requests", () => {
    expect(resolveAccessScope("EVENT_COORDINATOR_LEAD", USER_ID, "venue_bookings")).toEqual({ scopeType: "NONE" });
    expect(resolveAccessScope("EVENT_COORDINATOR_LEAD", USER_ID, "equipment_requests")).toEqual({ scopeType: "NONE" });
  });
});

describe("notInScopeMessage (A4)", () => {
  const OTHERWISE = "No event with that reference is available to you.";

  it("tells a coordinator the event is not assigned to them", () => {
    expect(notInScopeMessage("EVENT_COORDINATOR", OTHERWISE)).toBe("No event with that reference is assigned to you.");
  });

  it("tells a coordinator a record is not on an event assigned to them", () => {
    expect(notInScopeMessage("EVENT_COORDINATOR", OTHERWISE, "booking request")).toBe(
      "No booking request with that id is on an event assigned to you."
    );
    expect(notInScopeMessage("EVENT_COORDINATOR", OTHERWISE, "change request")).toBe(
      "No change request with that id is on an event assigned to you."
    );
  });

  it("keeps the module's own wording for every other role, the Lead included", () => {
    expect(notInScopeMessage("EVENT_ORGANISER", OTHERWISE)).toBe(OTHERWISE);
    expect(notInScopeMessage("EVENT_COORDINATOR_LEAD", OTHERWISE, "hold")).toBe(OTHERWISE);
  });
});
