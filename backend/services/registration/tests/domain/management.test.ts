import { describe, expect, it } from "vitest";
import {
  additionPreview,
  mayManage,
  MAX_REASON_LENGTH,
  readAdditionRequest,
  registrationTotals,
  takesAdditions,
} from "../../src/domain/management.js";
import {
  additionDuplicateMessage,
  attendeeNotFoundMessage,
  eventClosedMessage,
  noBookingMessage,
  overCapacityMessage,
  waitlistDuplicateMessage,
  waitlistNotActiveMessage,
  waitlistPlacesMessage,
  waitlistRegisteredMessage,
} from "../../src/domain/refusals.js";

/** R5 to R7 — the organiser's side, pure: who manages, the totals, the addition preview and form, and the refusals. */

const OWNER = "00000000-0000-0000-0000-000000000001";
const COORDINATOR = "00000000-0000-0000-0000-000000000002";
const OTHER = "00000000-0000-0000-0000-000000000007";
const event = { reference: "EVT-000123", name: "R Test Symposium" };

describe("mayManage (R5-T3, R7-T3)", () => {
  it("admits the owner and the assigned coordinator, and nobody else", () => {
    const managed = { ownerId: OWNER, assignedCoordinatorId: COORDINATOR };
    expect([OWNER, COORDINATOR, OTHER].map((id) => mayManage(managed, id))).toEqual([true, true, false]);
  });

  it("admits only the owner while no coordinator is assigned", () => {
    const unassigned = { ownerId: OWNER, assignedCoordinatorId: null };
    expect([OWNER, COORDINATOR].map((id) => mayManage(unassigned, id))).toEqual([true, false]);
  });
});

describe("takesAdditions (R7)", () => {
  it("refuses a cancelled, completed or rejected event, and takes any other", () => {
    expect(["CANCELLED", "COMPLETED", "REJECTED"].map(takesAdditions)).toEqual([false, false, false]);
    expect(["CONFIRMED", "PLANNING", "APPROVED", "SAFETY_REVIEW"].map(takesAdditions)).toEqual([true, true, true, true]);
  });
});

describe("registrationTotals (R5-T4, R5-T6, R7-T9)", () => {
  const basis = { registered: 2, withdrawn: 1, cancelled: 0, manuallyAdded: 1, addedOverCapacity: 0, capacity: 4, freeSeats: 2, unseatedRegistrations: 0 };

  it("counts each status from the records and takes places remaining from R2's rule", () => {
    expect(registrationTotals(basis)).toEqual({
      registered: 2,
      withdrawn: 1,
      cancelled: 0,
      manuallyAdded: 1,
      addedOverCapacity: 0,
      capacity: 4,
      placesRemaining: 2,
      overCapacityBy: 0,
    });
  });

  it("R2-T13 never shows negative places, and says how far over capacity the event is (D-01)", () => {
    const over = registrationTotals({ ...basis, registered: 3, capacity: 2, freeSeats: 0, unseatedRegistrations: 1, addedOverCapacity: 1 });
    expect([over.placesRemaining, over.overCapacityBy]).toEqual([0, 1]);
    expect(registrationTotals({ ...basis, registered: 2, capacity: 2 }).overCapacityBy).toBe(0);
  });
});

describe("additionPreview (R7-T5, R7-T7)", () => {
  it("gives the capacity and the total the addition would make", () => {
    expect(additionPreview(5, 4)).toEqual({ capacity: 5, totalAfter: 5, overCapacity: false });
  });

  it("is over capacity only once the total would exceed it", () => {
    expect(additionPreview(2, 2)).toEqual({ capacity: 2, totalAfter: 3, overCapacity: true });
    expect(additionPreview(3, 2).overCapacity).toBe(false);
  });
});

describe("readAdditionRequest (R7-T13)", () => {
  const email = "attendee@connectsphere.test";

  it("takes the email trimmed, a blank reason as none, and confirmation only when true", () => {
    expect(readAdditionRequest({ attendeeEmail: `  ${email} `, reason: "   " })).toEqual({
      ok: true,
      value: { attendeeEmail: email, reason: null, confirmOverCapacity: false },
    });
    expect(readAdditionRequest({ attendeeEmail: email, reason: " Keynote speaker's guest ", confirmOverCapacity: true })).toEqual({
      ok: true,
      value: { attendeeEmail: email, reason: "Keynote speaker's guest", confirmOverCapacity: true },
    });
    expect(readAdditionRequest({ attendeeEmail: email, reason: null, confirmOverCapacity: false })).toMatchObject({ ok: true, value: { reason: null } });
  });

  it("keeps a reason of exactly 500 characters and refuses 501", () => {
    const longest = "r".repeat(MAX_REASON_LENGTH);
    expect(readAdditionRequest({ attendeeEmail: email, reason: longest })).toMatchObject({ ok: true, value: { reason: longest } });
    expect(readAdditionRequest({ attendeeEmail: email, reason: `${longest}r` })).toEqual({
      ok: false,
      fields: [{ field: "reason", message: "Keep the reason to 500 characters." }],
    });
  });

  it("names every field in error: no email, a malformed or overlong one, a reason that isn't text, a confirmation that isn't true or false", () => {
    expect(readAdditionRequest(undefined)).toEqual({ ok: false, fields: [{ field: "attendeeEmail", message: "Give the email address of the attendee's account." }] });
    expect(readAdditionRequest({ attendeeEmail: "not-an-email" })).toMatchObject({ ok: false, fields: [{ field: "attendeeEmail" }] });
    expect(readAdditionRequest({ attendeeEmail: `${"a".repeat(250)}@x.sg` })).toMatchObject({ ok: false, fields: [{ field: "attendeeEmail" }] });
    expect(readAdditionRequest({ attendeeEmail: 42, reason: 7, confirmOverCapacity: "yes" })).toEqual({
      ok: false,
      fields: [
        { field: "attendeeEmail", message: "Give the email address of the attendee's account." },
        { field: "reason", message: "The reason must be text." },
        { field: "confirmOverCapacity", message: "Say true to add above capacity." },
      ],
    });
  });

  it("accepts an email of exactly 254 characters", () => {
    const longest = `${"a".repeat(243)}@connect.sg`;
    expect(longest).toHaveLength(254);
    expect(readAdditionRequest({ attendeeEmail: longest }).ok).toBe(true);
  });
});

describe("the R6 and R7 refusals name their cause", () => {
  it("R6-T2 places remain: one place, or several", () => {
    expect(waitlistPlacesMessage(event, 1)).toBe("EVT-000123 “R Test Symposium” still has 1 place remaining, so register instead of joining the waitlist.");
    expect(waitlistPlacesMessage(event, 3)).toBe("EVT-000123 “R Test Symposium” still has 3 places remaining, so register instead of joining the waitlist.");
  });

  it("R6-T3, R6-T4 name the registration held, or the first entry", () => {
    expect(waitlistRegisteredMessage(event, "REG-000042")).toBe(
      "You are already registered for EVT-000123 “R Test Symposium” (registration REG-000042), so you can't also join its waitlist.",
    );
    expect(waitlistDuplicateMessage(event, "WL-000007")).toBe(
      "You are already on the waitlist for EVT-000123 “R Test Symposium” (WL-000007), so no second entry was made.",
    );
  });

  it("R6-T8 say what became of an entry that is no longer waiting", () => {
    expect(waitlistNotActiveMessage("WL-000007", "WITHDRAWN")).toBe("Waitlist entry WL-000007 was already left, so there is nothing to leave.");
    expect(waitlistNotActiveMessage("WL-000007", "REGISTERED")).toBe("Waitlist entry WL-000007 ended when you registered, so there is nothing to leave.");
    expect(waitlistNotActiveMessage("WL-000007", "CANCELLED")).toBe("Waitlist entry WL-000007 was cancelled with the event, so there is nothing to leave.");
  });

  it("R7-T13, R7-T8, R7-T6, R7-T10 name the email, the missing booking, the capacity and new total, and the registration held", () => {
    expect(attendeeNotFoundMessage("nobody@connectsphere.test")).toBe(
      "No attendee account has the email nobody@connectsphere.test, so nobody was added. Only someone who signs in as an attendee can be added.",
    );
    expect(noBookingMessage(event)).toBe(
      "EVT-000123 “R Test Symposium” has no confirmed venue booking, so its capacity is not known yet and nobody can be added.",
    );
    expect(overCapacityMessage(event, 2, 3)).toBe(
      "EVT-000123 “R Test Symposium” has a capacity of 2. Adding this attendee makes 3, above capacity, so they were not added. Confirm to add them anyway.",
    );
    expect(additionDuplicateMessage(event, "attendee@connectsphere.test", "REG-000042")).toBe(
      "attendee@connectsphere.test already holds registration REG-000042 for EVT-000123 “R Test Symposium”, so they were not added again.",
    );
    expect(eventClosedMessage(event, "Cancelled")).toBe("EVT-000123 “R Test Symposium” is Cancelled, so nobody can be added to it.");
  });
});
