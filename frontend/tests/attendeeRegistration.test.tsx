import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ApiError } from "../src/api/client.js";
import type { OpenEvent, RegistrationView, WaitlistEntryView } from "../src/api/registration.js";

/**
 * R1 to R4 — the attendee surface (implementation.md §7.2) in the web app,
 * with the registration service's answers stubbed. The rules themselves, and
 * the refusals' words, are the server's and are tested there; these check that
 * the screens show what the server says, offer Register only when places
 * remain, confirm before withdrawing, and give attendees their own shell.
 */

const symposium: OpenEvent = {
  eventId: "e-1",
  reference: "EVT-000123",
  name: "R Test Symposium",
  description: "A one-day symposium for the school of computing.",
  startsAt: "2026-12-16T06:00:00.000Z",
  endsAt: "2026-12-16T10:00:00.000Z",
  venues: [{ name: "Lee Kong Chian Auditorium", location: "School of Computing, Level 1" }],
  registrationOpensAt: "2026-12-01T01:00:00.000Z",
  registrationClosesAt: "2026-12-10T10:00:00.000Z",
  withdrawalDeadline: "2026-12-14T10:00:00.000Z",
  placesRemaining: 3,
  isFull: false,
  highDemand: false,
};

const registration = (over: Partial<RegistrationView> = {}): RegistrationView => ({
  id: "r-1",
  reference: "REG-000042",
  status: "REGISTERED",
  registeredAt: "2026-12-05T02:00:00.000Z",
  withdrawnAt: null,
  cancelledAt: null,
  event: {
    eventId: "e-1",
    reference: "EVT-000123",
    name: "R Test Symposium",
    startsAt: symposium.startsAt,
    endsAt: symposium.endsAt,
    venues: symposium.venues,
    withdrawalDeadline: symposium.withdrawalDeadline,
  },
  ...over,
});

const entry = (over: Partial<WaitlistEntryView> = {}): WaitlistEntryView => ({
  id: "w-1",
  reference: "WL-000007",
  status: "WAITLISTED",
  position: 1,
  joinedAt: "2026-12-05T02:00:00.000Z",
  lastNotifiedAt: null,
  registeredAt: null,
  withdrawnAt: null,
  cancelledAt: null,
  event: { eventId: "e-1", reference: "EVT-000123", name: "R Test Symposium", startsAt: symposium.startsAt, endsAt: symposium.endsAt },
  ...over,
});

const refusal = (status: number, code: string, message: string, details?: Record<string, unknown>) =>
  new ApiError(status, { code, message, details, correlationId: null });

const api = vi.hoisted(() => ({
  listOpenEvents: vi.fn(),
  getOpenEvent: vi.fn(),
  registerFor: vi.fn(),
  listMyRegistrations: vi.fn(),
  withdrawRegistration: vi.fn(),
  saveRegistrationSettings: vi.fn(),
  joinWaitlist: vi.fn(),
  listMyWaitlist: vi.fn(),
  leaveWaitlist: vi.fn(),
}));
vi.mock("../src/api/registration.js", () => api);
vi.mock("../src/api/notifications.js", async () => {
  const actual = await vi.importActual<typeof import("../src/api/notifications.js")>("../src/api/notifications.js");
  return { ...actual, listNotifications: vi.fn(async () => ({ items: [], unreadCount: 0, nextCursor: null })) };
});

const { App } = await import("../src/App.js");

function signInAs(role: string, hash: string) {
  sessionStorage.setItem(
    "connectsphere.session",
    JSON.stringify({ userId: "user-id", email: "attendee@connectsphere.test", role, token: "token", lastLoginAt: "2026-12-01T01:00:00.000Z" }),
  );
  window.location.hash = hash;
}

beforeEach(() => {
  for (const fn of Object.values(api)) fn.mockReset();
  api.listOpenEvents.mockResolvedValue({ items: [symposium], nextCursor: null });
  api.getOpenEvent.mockResolvedValue(symposium);
  api.listMyRegistrations.mockResolvedValue({ items: [], nextCursor: null });
  api.listMyWaitlist.mockResolvedValue({ items: [], nextCursor: null });
});
afterEach(() => {
  cleanup();
  sessionStorage.clear();
});

describe("Events (R1)", () => {
  it("R1-T1 lists an open event with its name, description, date, times, venue and location, and places remaining", async () => {
    signInAs("ATTENDEE", "#/open-events");
    render(<App />);

    const card = await screen.findByRole("article", { name: "R Test Symposium" });
    expect(card.textContent).toContain("A one-day symposium for the school of computing.");
    expect(card.textContent).toContain("Wednesday 16 December 2026, 14:00–18:00");
    expect(within(card).getByRole("list", { name: "Venues" }).textContent).toBe("Lee Kong Chian Auditorium — School of Computing, Level 1");
    expect(card.textContent).toContain("3 places remaining");
    expect(within(card).getByRole("link", { name: "View event" }).getAttribute("href")).toBe("#/open-events/e-1");
  });

  it("R1-T2 lists each of an event's venues", async () => {
    api.listOpenEvents.mockResolvedValue({
      items: [{ ...symposium, venues: [...symposium.venues, { name: "Seminar Room 2-1", location: "School of Computing, Level 2" }], placesRemaining: 5 }],
      nextCursor: null,
    });
    signInAs("ATTENDEE", "#/open-events");
    render(<App />);

    const venues = await screen.findByRole("list", { name: "Venues" });
    expect(within(venues).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "Lee Kong Chian Auditorium — School of Computing, Level 1",
      "Seminar Room 2-1 — School of Computing, Level 2",
    ]);
    expect(screen.getByText("5 places remaining")).toBeTruthy();
  });

  it("R1-T6 shows a full event as Full, and its page offers no Register action", async () => {
    const full = { ...symposium, placesRemaining: 0, isFull: true };
    api.listOpenEvents.mockResolvedValue({ items: [full], nextCursor: null });
    api.getOpenEvent.mockResolvedValue(full);
    signInAs("ATTENDEE", "#/open-events");
    render(<App />);

    const card = await screen.findByRole("article", { name: "R Test Symposium" });
    expect(within(card).getByText("Full")).toBeTruthy();
    expect(card.textContent).not.toContain("places remaining");

    cleanup();
    signInAs("ATTENDEE", "#/open-events/e-1");
    render(<App />);
    await screen.findByRole("heading", { name: "R Test Symposium" });
    expect(screen.getByText("Full")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Register" })).toBeNull();
  });

  it("R1-T7 shows one place remaining, and Register on its page", async () => {
    api.listOpenEvents.mockResolvedValue({ items: [{ ...symposium, placesRemaining: 1 }], nextCursor: null });
    api.getOpenEvent.mockResolvedValue({ ...symposium, placesRemaining: 1 });
    signInAs("ATTENDEE", "#/open-events");
    render(<App />);
    expect(await screen.findByText("1 place remaining")).toBeTruthy();

    cleanup();
    signInAs("ATTENDEE", "#/open-events/e-1");
    render(<App />);
    expect(await screen.findByRole("button", { name: "Register" })).toBeTruthy();
  });

  it("says so when no event is open, and loads more when there is a next page", async () => {
    api.listOpenEvents.mockResolvedValueOnce({ items: [symposium], nextCursor: "next" }).mockResolvedValueOnce({
      items: [{ ...symposium, eventId: "e-2", name: "R Second Talk" }],
      nextCursor: null,
    });
    signInAs("ATTENDEE", "#/open-events");
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Show more events" }));
    expect(await screen.findByRole("article", { name: "R Second Talk" })).toBeTruthy();
    expect(api.listOpenEvents).toHaveBeenLastCalledWith("token", "next");

    cleanup();
    api.listOpenEvents.mockResolvedValue({ items: [], nextCursor: null });
    render(<App />);
    expect(await screen.findByText("No events are open for registration right now.")).toBeTruthy();
  });
});

describe("Register (R2)", () => {
  async function openAndRegister() {
    signInAs("ATTENDEE", "#/open-events/e-1");
    render(<App />);
    expect(await screen.findByText(/Registration is open from Tuesday 1 December 2026, 09:00 to Thursday 10 December 2026, 18:00/)).toBeTruthy();
    expect(screen.getByText("You can withdraw until Monday 14 December 2026, 18:00.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Register" }));
  }

  it("R2-T1 confirms the registration with its reference, and points to My registrations", async () => {
    api.registerFor.mockResolvedValue(registration());
    await openAndRegister();

    const confirmed = await screen.findByText("You are registered");
    expect(api.registerFor).toHaveBeenCalledWith("token", "e-1");
    expect(confirmed.closest("section")!.textContent).toContain("Registration REG-000042 for R Test Symposium is confirmed.");
    expect(within(screen.getByRole("main")).getByRole("link", { name: "My registrations" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Register" })).toBeNull();
  });

  it("R2-T4 shows the refusal for capacity in the server's words, and offers the waitlist", async () => {
    const message = "EVT-000123 “R Test Symposium” has no places remaining, so you were not registered. You can ask for a place on the waitlist instead.";
    api.registerFor.mockRejectedValue(refusal(409, "REGISTRATION_FULL", message, { waitlistOffered: true }));
    await openAndRegister();

    expect(await screen.findByText(message)).toBeTruthy();
    expect(screen.getByText("You were not registered")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Join the waitlist" }) as HTMLButtonElement).disabled).toBe(false);
    expect(api.getOpenEvent).toHaveBeenCalledTimes(2);
  });

  it("R6-T1 joins the waitlist from the capacity refusal, showing the entry and its place in line", async () => {
    api.registerFor.mockRejectedValue(refusal(409, "REGISTRATION_FULL", "No places remaining.", { waitlistOffered: true }));
    api.joinWaitlist.mockResolvedValue(entry());
    await openAndRegister();

    fireEvent.click(await screen.findByRole("button", { name: "Join the waitlist" }));

    const joined = await screen.findByText("You are on the waitlist");
    expect(api.joinWaitlist).toHaveBeenCalledWith("token", "e-1");
    expect(joined.closest("section")!.textContent).toContain("WL-000007: you are number 1 in line for R Test Symposium.");
    expect(screen.queryByRole("button", { name: "Join the waitlist" })).toBeNull();
  });

  it("R6-T1 offers the waitlist, not Register, on a full event's page, and shows a refusal to join in the server's words", async () => {
    api.getOpenEvent.mockResolvedValue({ ...symposium, placesRemaining: 0, isFull: true });
    const message = "EVT-000123 “R Test Symposium” still has 1 place remaining, so register instead of joining the waitlist.";
    api.joinWaitlist.mockRejectedValue(refusal(409, "WAITLIST_PLACES_AVAILABLE", message, { placesRemaining: 1 }));
    signInAs("ATTENDEE", "#/open-events/e-1");
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Join the waitlist" }));

    expect(await screen.findByText(message)).toBeTruthy();
    expect(screen.getByText("You were not added to the waitlist")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Register" })).toBeNull();
  });

  it("R2-T6 R2-T8 shows a duplicate or out-of-window refusal in the server's words, with no waitlist offer", async () => {
    for (const [code, message] of [
      ["REGISTRATION_DUPLICATE", "You are already registered for EVT-000123 “R Test Symposium” (registration REG-000042), so no second registration was made."],
      ["REGISTRATION_OUTSIDE_WINDOW", "Registration for EVT-000123 “R Test Symposium” opens on Tuesday 1 December 2026, 09:00 and closes on Thursday 10 December 2026, 18:00, so you cannot register now."],
    ]) {
      api.registerFor.mockRejectedValue(refusal(code === "REGISTRATION_DUPLICATE" ? 409 : 422, code!, message!));
      await openAndRegister();
      expect(await screen.findByText(message!)).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Join the waitlist" })).toBeNull();
      cleanup();
    }
  });

  it("says an event that is not open is not open, without showing anything of it", async () => {
    api.getOpenEvent.mockRejectedValue(refusal(404, "EVENT_NOT_FOUND", "No event open for registration has that id."));
    signInAs("ATTENDEE", "#/open-events/e-9");
    render(<App />);
    expect(await screen.findByText("No event open for registration has that id.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Register" })).toBeNull();
  });
});

describe("My registrations (R3, R4)", () => {
  const rows = [
    registration({ id: "r-2", reference: "REG-000043", status: "WITHDRAWN", withdrawnAt: "2026-12-05T03:00:00.000Z" }),
    registration(),
    registration({ id: "r-3", reference: "REG-000044", status: "CANCELLED", cancelledAt: "2026-12-06T02:00:00.000Z" }),
  ];
  const rowOf = (reference: string) =>
    within(screen.getByRole("list", { name: "My registrations" }))
      .getAllByRole("listitem")
      .find((li) => li.textContent!.includes(reference))!;

  beforeEach(() => api.listMyRegistrations.mockResolvedValue({ items: rows, nextCursor: null }));

  it("R3-T1 R3-T4 R3-T5 shows each registration's event, times, location, status and timestamps, with Withdraw only on a Registered one", async () => {
    signInAs("ATTENDEE", "#/my-registrations");
    render(<App />);
    await screen.findByRole("list", { name: "My registrations" });

    const active = rowOf("REG-000042");
    expect(active.textContent).toContain("R Test Symposium");
    expect(active.textContent).toContain("Wednesday 16 December 2026, 14:00–18:00");
    expect(active.textContent).toContain("School of Computing, Level 1");
    expect(active.textContent).toContain("Registered Saturday 5 December 2026, 10:00");
    expect(active.textContent).not.toContain("Withdrawn");
    expect(within(active).getByRole("button", { name: "Withdraw" })).toBeTruthy();

    const withdrawn = rowOf("REG-000043");
    expect(withdrawn.textContent).toContain("Withdrawn Saturday 5 December 2026, 11:00");
    expect(within(withdrawn).queryByRole("button", { name: "Withdraw" })).toBeNull();

    const cancelled = rowOf("REG-000044");
    expect(within(cancelled).getByText("Cancelled")).toBeTruthy();
    expect(within(cancelled).queryByRole("button", { name: "Withdraw" })).toBeNull();
  });

  it("R3-T6 says when there are no registrations, with a way to the events", async () => {
    api.listMyRegistrations.mockResolvedValue({ items: [], nextCursor: null });
    signInAs("ATTENDEE", "#/my-registrations");
    render(<App />);
    expect(await screen.findByText(/You have no registrations yet\./)).toBeTruthy();
    expect(within(screen.getByRole("main")).getByRole("link", { name: "Events" }).getAttribute("href")).toBe("#/open-events");
  });

  it("R4-T1 asks before withdrawing, then shows the registration as Withdrawn", async () => {
    api.withdrawRegistration.mockResolvedValue(registration({ status: "WITHDRAWN", withdrawnAt: "2026-12-05T04:00:00.000Z" }));
    signInAs("ATTENDEE", "#/my-registrations");
    render(<App />);
    await screen.findByRole("list", { name: "My registrations" });

    fireEvent.click(within(rowOf("REG-000042")).getByRole("button", { name: "Withdraw" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog.textContent).toContain("will be released for someone else");
    fireEvent.click(within(dialog).getByRole("button", { name: "Withdraw registration" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(api.withdrawRegistration).toHaveBeenCalledWith("token", "r-1");
    expect(rowOf("REG-000042").textContent).toContain("Withdrawn Saturday 5 December 2026, 12:00");
    expect(within(rowOf("REG-000042")).queryByRole("button", { name: "Withdraw" })).toBeNull();
  });

  it("R4-T6 keeps the deadline refusal in the dialog in the server's words, and the row unchanged", async () => {
    const message = "The withdrawal deadline for EVT-000123 “R Test Symposium” was Monday 14 December 2026, 18:00, so registration REG-000042 can no longer be withdrawn.";
    api.withdrawRegistration.mockRejectedValue(refusal(422, "WITHDRAWAL_DEADLINE_PASSED", message));
    signInAs("ATTENDEE", "#/my-registrations");
    render(<App />);
    await screen.findByRole("list", { name: "My registrations" });

    fireEvent.click(within(rowOf("REG-000042")).getByRole("button", { name: "Withdraw" }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Withdraw registration" }));

    expect(await within(screen.getByRole("dialog")).findByText(message)).toBeTruthy();
    expect(within(rowOf("REG-000042")).getByText("Registered")).toBeTruthy();
  });

  it("R4-T11 keeping the place closes the dialog and changes nothing", async () => {
    signInAs("ATTENDEE", "#/my-registrations");
    render(<App />);
    await screen.findByRole("list", { name: "My registrations" });

    fireEvent.click(within(rowOf("REG-000042")).getByRole("button", { name: "Withdraw" }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Keep my place" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(api.withdrawRegistration).not.toHaveBeenCalled();
    expect(within(rowOf("REG-000042")).getByRole("button", { name: "Withdraw" })).toBeTruthy();
  });
});

describe("My waitlist entries (R6)", () => {
  it("R6-T7 R6-T10 shows each entry's status, its place in line while waiting, and an opening it was told of", async () => {
    api.listMyWaitlist.mockResolvedValue({
      items: [
        entry({ lastNotifiedAt: "2026-12-06T02:00:00.000Z" }),
        entry({ id: "w-2", reference: "WL-000008", status: "REGISTERED", position: null, registeredAt: "2026-12-06T03:00:00.000Z" }),
        entry({ id: "w-3", reference: "WL-000009", status: "CANCELLED", position: null, cancelledAt: "2026-12-07T02:00:00.000Z" }),
      ],
      nextCursor: null,
    });
    signInAs("ATTENDEE", "#/my-registrations");
    render(<App />);

    const list = await screen.findByRole("list", { name: "My waitlist entries" });
    const items = within(list).getAllByRole("listitem");
    expect(items[0]!.textContent).toContain("Waitlisted");
    expect(items[0]!.textContent).toContain("Number 1 in line");
    expect(items[0]!.textContent).toContain("A place opened on");
    expect(within(items[0]!).getByRole("link", { name: "Register" }).getAttribute("href")).toBe("#/open-events/e-1");
    expect(items[1]!.textContent).toContain("Registered");
    expect(items[2]!.textContent).toContain("Cancelled");
    expect(within(items[1]!).queryByRole("button", { name: "Leave the waitlist" })).toBeNull();
  });

  it("R6-T8 asks before leaving the waitlist, then shows the entry as left", async () => {
    api.listMyWaitlist.mockResolvedValue({ items: [entry()], nextCursor: null });
    api.leaveWaitlist.mockResolvedValue(entry({ status: "WITHDRAWN", position: null, withdrawnAt: "2026-12-06T02:00:00.000Z" }));
    signInAs("ATTENDEE", "#/my-registrations");
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Leave the waitlist" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog.textContent).toContain("You will no longer be told when a place opens");
    expect(api.leaveWaitlist).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Leave the waitlist" }));

    await waitFor(() => expect(api.leaveWaitlist).toHaveBeenCalledWith("token", "w-1"));
    const list = await screen.findByRole("list", { name: "My waitlist entries" });
    await waitFor(() => expect(list.textContent).toContain("Left the waitlist"));
  });
});

describe("the attendee shell (§7.2, ADR-0014)", () => {
  it("lands an attendee on Events, with only the attendee's screens in a navigation of its own", async () => {
    signInAs("ATTENDEE", "#/");
    render(<App />);
    await screen.findByRole("heading", { name: "Events" });

    const nav = screen.getByRole("navigation", { name: "Attendee" });
    expect(within(nav).getAllByRole("link").map((a) => a.textContent)).toEqual(["Events", "My registrations", "Notifications"]);
    expect(screen.queryByText("API console")).toBeNull();
    expect(screen.queryByText("My requests")).toBeNull();
  });

  it("keeps staff out of the attendee screens and attendees out of the staff ones", async () => {
    signInAs("EVENT_ORGANISER", "#/open-events");
    render(<App />);
    await waitFor(() => expect(window.location.hash).toBe("#/requests"));
    expect(screen.queryByTestId("attendee-shell")).toBeNull();

    cleanup();
    signInAs("ATTENDEE", "#/requests");
    render(<App />);
    await waitFor(() => expect(window.location.hash).toBe("#/open-events"));
  });

  it("fits a 360px phone: one column at most 720px wide that fills the screen, and no fixed width wider than the phone", async () => {
    window.innerWidth = 360;
    window.dispatchEvent(new Event("resize"));
    api.listMyRegistrations.mockResolvedValue({ items: [registration()], nextCursor: null });
    for (const hash of ["#/open-events", "#/open-events/e-1", "#/my-registrations"]) {
      signInAs("ATTENDEE", hash);
      const { container } = render(<App />);
      await screen.findAllByRole("heading");
      const main = container.querySelector("main")!;
      expect(main.style.maxWidth).toBe("720px");
      expect(main.style.width).toBe("100%");
      for (const element of Array.from(container.querySelectorAll<HTMLElement>("[style]"))) {
        const width = parseFloat(element.style.width);
        if (element.style.width.endsWith("px")) expect(width, `${hash} ${element.tagName}`).toBeLessThanOrEqual(360);
        if (element.style.minWidth.endsWith("px")) expect(parseFloat(element.style.minWidth)).toBeLessThanOrEqual(360);
      }
      cleanup();
    }
  });
});
