import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ApiError } from "../src/api/client.js";
import type { EventRegistrations, EventWaitlist, ManagedRegistration } from "../src/api/registration.js";

/**
 * R5 to R7 — the organiser's Registrations screen, with the registration
 * service's answers stubbed. Who may see the list, the totals and the rules
 * are the server's and are tested there; these check that the screen shows
 * each row and total, tells manual additions apart, shows the capacity and the
 * new total before an addition is saved (D-01), and shows the waitlist in order.
 */

const organiser = { id: "00000000-0000-0000-0000-000000000001", name: "Organiser One", email: "organiser@connectsphere.test" };
const attendeeOne = { id: "00000000-0000-0000-0000-000000000005", name: "Attendee One", email: "attendee@connectsphere.test" };

const row = (over: Partial<ManagedRegistration> = {}): ManagedRegistration => ({
  id: "r-1",
  reference: "REG-000042",
  attendee: attendeeOne,
  status: "REGISTERED",
  registeredAt: "2026-12-05T02:00:00.000Z",
  withdrawnAt: null,
  cancelledAt: null,
  manualAddition: null,
  holdsSeat: true,
  ...over,
});

const listOf = (items: ManagedRegistration[], totals: Partial<EventRegistrations["totals"]> = {}): EventRegistrations => ({
  event: { eventId: "e-1", reference: "EVT-000123", name: "R Test Symposium", status: "CONFIRMED", startsAt: "2026-12-16T06:00:00.000Z" },
  totals: { registered: 1, withdrawn: 0, cancelled: 0, manuallyAdded: 0, addedOverCapacity: 0, capacity: 3, placesRemaining: 2, overCapacityBy: 0, ...totals },
  waitlist: { waiting: 0 },
  items,
  nextCursor: null,
  namesAvailable: true,
});

const noWaitlist: EventWaitlist = { event: listOf([]).event, waiting: 0, items: [], nextCursor: null, namesAvailable: true };

const api = vi.hoisted(() => ({
  listEventRegistrations: vi.fn(),
  listEventWaitlist: vi.fn(),
  addAttendee: vi.fn(),
}));
vi.mock("../src/api/registration.js", async () => {
  const actual = await vi.importActual<typeof import("../src/api/registration.js")>("../src/api/registration.js");
  return { ...actual, ...api };
});
vi.mock("../src/api/notifications.js", async () => {
  const actual = await vi.importActual<typeof import("../src/api/notifications.js")>("../src/api/notifications.js");
  return { ...actual, listNotifications: vi.fn(async () => ({ items: [], unreadCount: 0, nextCursor: null })) };
});

const { App } = await import("../src/App.js");

function openAs(role: string) {
  sessionStorage.setItem(
    "connectsphere.session",
    JSON.stringify({ userId: organiser.id, email: organiser.email, role, token: "token", lastLoginAt: "2026-12-01T01:00:00.000Z" }),
  );
  window.location.hash = "#/events/e-1/registrations";
  render(<App />);
}

const refusal = (status: number, code: string, message: string, details?: Record<string, unknown>) =>
  new ApiError(status, { code, message, details, correlationId: null });

beforeEach(() => {
  for (const fn of Object.values(api)) fn.mockReset();
  api.listEventRegistrations.mockResolvedValue(listOf([row()]));
  api.listEventWaitlist.mockResolvedValue(noWaitlist);
});
afterEach(() => {
  cleanup();
  sessionStorage.clear();
});

describe("Registrations (R5)", () => {
  it("R5-T1 shows each registration's attendee name, time and status, self-registered", async () => {
    openAs("EVENT_ORGANISER");

    const table = await screen.findByRole("table", { name: "Registrations" });
    const cells = within(table).getAllByRole("row")[1]!.textContent!;
    expect(cells).toContain("Attendee One");
    expect(cells).toContain("Saturday 5 December 2026, 10:00");
    expect(cells).toContain("Registered");
    expect(cells).toContain("Self-registered");
    expect(api.listEventRegistrations).toHaveBeenCalledWith("token", "e-1");
  });

  it("R5-T2 is open to the assigned coordinator too", async () => {
    openAs("EVENT_COORDINATOR");
    expect(await screen.findByRole("table", { name: "Registrations" })).toBeTruthy();
  });

  it("R5-T4 shows the totals for registered, withdrawn and places remaining, with the capacity", async () => {
    api.listEventRegistrations.mockResolvedValue(
      listOf([row(), row({ id: "r-2" }), row({ id: "r-3", status: "WITHDRAWN", withdrawnAt: "2026-12-06T02:00:00.000Z" })], {
        registered: 2,
        withdrawn: 1,
        capacity: 4,
        placesRemaining: 2,
      }),
    );
    openAs("EVENT_ORGANISER");

    const totals = await screen.findByRole("list", { name: "Totals" });
    expect(totals.textContent).toContain("Registered 2");
    expect(totals.textContent).toContain("Withdrawn 1");
    expect(totals.textContent).toContain("Places remaining 2");
    expect(totals.textContent).toContain("Capacity 4");
    expect(screen.getByText("Withdrawn Sunday 6 December 2026, 10:00")).toBeTruthy();
  });

  it("R5-T6 says when no one has registered yet", async () => {
    api.listEventRegistrations.mockResolvedValue(listOf([], { registered: 0, placesRemaining: 3 }));
    openAs("EVENT_ORGANISER");
    expect(await screen.findByText("No one has registered yet.")).toBeTruthy();
    expect(screen.getByRole("list", { name: "Totals" }).textContent).toContain("Places remaining 3");
  });

  it("R5-T3 shows nothing of the event to someone who doesn't manage it", async () => {
    api.listEventRegistrations.mockRejectedValue(refusal(404, "EVENT_NOT_FOUND", "No event you manage has that id."));
    openAs("EVENT_ORGANISER");
    expect(await screen.findByText("This event's registrations are not available to you")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("R7-T9 tells a manual addition apart: who added it, why, and when it went over capacity", async () => {
    api.listEventRegistrations.mockResolvedValue(
      listOf([row(), row({ id: "r-2", manualAddition: { addedBy: organiser, reason: "Guest of honour", overCapacity: true }, holdsSeat: false })], {
        registered: 2,
        manuallyAdded: 1,
        overCapacityBy: 1,
      }),
    );
    openAs("EVENT_ORGANISER");

    const rows = within(await screen.findByRole("table", { name: "Registrations" })).getAllByRole("row");
    expect(rows[2]!.textContent).toContain("Added by Organiser One");
    expect(rows[2]!.textContent).toContain("“Guest of honour”");
    expect(rows[2]!.textContent).toContain("Over capacity");
    expect(rows[2]!.textContent).toContain("Takes the next seat that is freed");
    expect(screen.getByRole("list", { name: "Totals" }).textContent).toContain("Added by hand 1");
  });
});

describe("Add an attendee (R7)", () => {
  function fillIn(email: string, reason = "") {
    fireEvent.change(screen.getByLabelText("Attendee's email"), { target: { value: email } });
    fireEvent.change(screen.getByLabelText("Reason (optional)"), { target: { value: reason } });
    fireEvent.click(screen.getByRole("button", { name: "Add attendee" }));
  }

  it("R7-T1 shows the capacity and the new total before saving, then adds and reloads", async () => {
    api.listEventRegistrations.mockResolvedValue(listOf([], { registered: 0, capacity: 3, placesRemaining: 3 }));
    api.addAttendee.mockResolvedValue({ ...row({ manualAddition: { addedBy: organiser, reason: "Keynote speaker's guest", overCapacity: false } }), capacity: 3, totalAfter: 1 });
    openAs("EVENT_ORGANISER");
    await screen.findByText("No one has registered yet.");

    fillIn("attendee@connectsphere.test", "Keynote speaker's guest");
    const dialog = await screen.findByRole("dialog");
    expect(dialog.textContent).toContain("Capacity 3");
    expect(dialog.textContent).toContain("With this addition: 1 attendee");
    expect(dialog.textContent).not.toContain("over capacity");
    expect(api.addAttendee).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Add attendee" }));

    await waitFor(() =>
      expect(api.addAttendee).toHaveBeenCalledWith("token", "e-1", { attendeeEmail: "attendee@connectsphere.test", reason: "Keynote speaker's guest", confirmOverCapacity: false }),
    );
    expect(await screen.findByText("Attendee One was added: registration REG-000042.")).toBeTruthy();
    expect(api.listEventRegistrations).toHaveBeenCalledTimes(2);
  });

  it("R7-T5 warns when the addition goes over capacity, and adds over capacity only once confirmed", async () => {
    api.listEventRegistrations.mockResolvedValue(listOf([row(), row({ id: "r-2" })], { registered: 2, capacity: 2, placesRemaining: 0 }));
    api.addAttendee.mockResolvedValue({ ...row({ id: "r-3", manualAddition: { addedBy: organiser, reason: null, overCapacity: true }, holdsSeat: false }), capacity: 2, totalAfter: 3 });
    openAs("EVENT_ORGANISER");
    await screen.findByRole("table", { name: "Registrations" });

    fillIn("attendee@connectsphere.test");
    const dialog = await screen.findByRole("dialog");
    expect(dialog.textContent).toContain("Capacity 2");
    expect(dialog.textContent).toContain("With this addition: 3 attendees");
    expect(dialog.textContent).toContain("This takes the event over capacity");
    fireEvent.click(within(dialog).getByRole("button", { name: "Add over capacity" }));

    await waitFor(() => expect(api.addAttendee).toHaveBeenCalledWith("token", "e-1", expect.objectContaining({ reason: null, confirmOverCapacity: true })));
  });

  it("R7-T6 cancelling saves nothing, and a seat taken meanwhile turns the dialog into the over-capacity question", async () => {
    api.listEventRegistrations.mockResolvedValue(listOf([row()], { registered: 1, capacity: 2, placesRemaining: 1 }));
    api.addAttendee.mockRejectedValueOnce(
      refusal(409, "REGISTRATION_OVER_CAPACITY_UNCONFIRMED", "Over capacity.", { capacity: 2, registered: 2, totalAfter: 3 }),
    );
    openAs("EVENT_ORGANISER");
    await screen.findByRole("table", { name: "Registrations" });

    fillIn("attendee@connectsphere.test");
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(api.addAttendee).not.toHaveBeenCalled();

    fillIn("attendee@connectsphere.test");
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Add attendee" }));
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(dialog.textContent).toContain("With this addition: 3 attendees"));
    expect(within(dialog).getByRole("button", { name: "Add over capacity" })).toBeTruthy();
  });

  it("R7-T10 R7-T13 keeps a refusal in the dialog in the server's words", async () => {
    const message = "No attendee account has the email nobody@connectsphere.test, so nobody was added. Only someone who signs in as an attendee can be added.";
    api.addAttendee.mockRejectedValue(refusal(422, "ATTENDEE_NOT_FOUND", message));
    openAs("EVENT_ORGANISER");
    await screen.findByRole("table", { name: "Registrations" });

    fillIn("nobody@connectsphere.test");
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Add attendee" }));

    expect(await within(screen.getByRole("dialog")).findByText(message)).toBeTruthy();
  });
});

describe("the waitlist on the Registrations screen (R6)", () => {
  it("R6-T5 R6-T9 shows each entry in the order joined, with its position, apart from the registrations", async () => {
    api.listEventWaitlist.mockResolvedValue({
      ...noWaitlist,
      waiting: 2,
      items: ["Ada", "Ben"].map((name, i) => ({
        id: `w-${i}`,
        reference: `WL-00000${i}`,
        status: "WAITLISTED" as const,
        position: i + 1,
        joinedAt: `2026-12-05T0${i + 2}:00:00.000Z`,
        lastNotifiedAt: null,
        registeredAt: null,
        withdrawnAt: null,
        cancelledAt: null,
        attendee: { id: `a-${i}`, name, email: `${name.toLowerCase()}@connectsphere.test` },
      })),
    });
    openAs("EVENT_ORGANISER");

    const rows = within(await screen.findByRole("table", { name: "Waitlist" })).getAllByRole("row");
    expect(rows.slice(1).map((r) => [r.cells[0]!.textContent, r.cells[1]!.textContent, r.cells[3]!.textContent])).toEqual([
      ["1", "Ada", "Waitlisted"],
      ["2", "Ben", "Waitlisted"],
    ]);
    expect(screen.getByText(/2 attendees are waiting\./)).toBeTruthy();
    expect(within(screen.getByRole("table", { name: "Registrations" })).getAllByRole("row")).toHaveLength(2);
  });
});
