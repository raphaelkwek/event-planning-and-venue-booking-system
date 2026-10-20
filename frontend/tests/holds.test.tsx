import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { ApiError } from "../src/api/client.js";

/**
 * L3 — tentative holds: the event's holds on its venue requests page, the hold
 * request form, converting a hold into a booking request, and the Venue Staff
 * hold queue.
 */

const EVENT_ID = "event-1";
const ASSIGNED = "assigned-coordinator";
const VENUE_ID = "venue-1";

const EVENT = {
  id: EVENT_ID,
  reference: "EVT-000123",
  name: "Annual Research Symposium",
  status: "APPROVED",
  assignedCoordinatorId: ASSIGNED,
  proposedStartAt: "2026-12-02T06:00:00.000Z",
  proposedEndAt: "2026-12-02T10:00:00.000Z",
  expectedAttendance: 150,
  venueRequirements: { layout: "theatre", facilities: ["Projector"], notes: null },
  accessibilityNeeds: "Step-free access to the stage",
};

function hold(overrides: Record<string, unknown> = {}) {
  return {
    id: "hold-1",
    reference: "HLD-000001",
    eventId: EVENT_ID,
    eventReference: "EVT-000123",
    venueId: VENUE_ID,
    venueName: "Lee Kong Chian Auditorium",
    startsAt: "2026-12-02T06:00:00.000Z",
    endsAt: "2026-12-02T10:00:00.000Z",
    reminderLeadMinutes: 1440,
    status: "HELD",
    requestedBy: ASSIGNED,
    requestedAt: "2026-10-19T02:00:00.000Z",
    placedBy: "venue-staff",
    placedAt: "2026-10-19T03:00:00.000Z",
    expiresAt: "2026-12-01T10:00:00.000Z",
    slotId: "slot-1",
    convertedRequestId: null,
    convertedBy: null,
    convertedAt: null,
    releasedBy: null,
    releasedAt: null,
    ...overrides,
  };
}

const VENUE = {
  id: VENUE_ID,
  name: "Lee Kong Chian Auditorium",
  building: "School of Computing",
  maxCapacity: 300,
  layouts: [{ name: "Theatre", capacity: 300 }],
  facilities: ["Projector"],
  accessibilityFeatures: ["Step-free access"],
  operatingHours: {},
  isActive: true,
};

type Fn = (...args: unknown[]) => Promise<unknown>;
const listEventHolds = vi.fn<Parameters<Fn>, ReturnType<Fn>>(async () => ({
  items: [hold(), hold({ id: "hold-2", reference: "HLD-000002", venueName: "Seminar Room 2-1", status: "REQUESTED", placedBy: null, placedAt: null, expiresAt: null, slotId: null })],
}));
const requestHold = vi.fn<Parameters<Fn>, ReturnType<Fn>>(async () => hold({ reference: "HLD-000003", status: "REQUESTED" }));
const releaseHold = vi.fn<Parameters<Fn>, ReturnType<Fn>>(async () => hold({ status: "RELEASED" }));
const convertHold = vi.fn<Parameters<Fn>, ReturnType<Fn>>(async () => ({ request: { reference: "BKR-000009" }, hold: hold({ status: "CONVERTED" }) }));
const listHoldQueue = vi.fn<Parameters<Fn>, ReturnType<Fn>>(async () => ({ items: [hold({ status: "REQUESTED", placedBy: null, placedAt: null, expiresAt: null })] }));
const placeHold = vi.fn<Parameters<Fn>, ReturnType<Fn>>(async () => hold());

vi.mock("../src/api/holds.js", async () => {
  const actual = await vi.importActual<typeof import("../src/api/holds.js")>("../src/api/holds.js");
  return {
    ...actual,
    listEventHolds: (...args: unknown[]) => listEventHolds(...args),
    requestHold: (...args: unknown[]) => requestHold(...args),
    releaseHold: (...args: unknown[]) => releaseHold(...args),
    convertHold: (...args: unknown[]) => convertHold(...args),
    listHoldQueue: (...args: unknown[]) => listHoldQueue(...args),
    placeHold: (...args: unknown[]) => placeHold(...args),
  };
});

vi.mock("../src/api/bookingRequests.js", async () => {
  const actual = await vi.importActual<typeof import("../src/api/bookingRequests.js")>("../src/api/bookingRequests.js");
  return {
    ...actual,
    listEventBookingRequests: vi.fn(async () => ({ event: EVENT, items: [] })),
    createBookingRequest: vi.fn(),
  };
});

vi.mock("../src/api/venues.js", async () => {
  const actual = await vi.importActual<typeof import("../src/api/venues.js")>("../src/api/venues.js");
  return {
    ...actual,
    listVenues: vi.fn(async () => ({ items: [{ id: VENUE_ID, name: "Lee Kong Chian Auditorium", building: "SoC", maxCapacity: 300, isActive: true }] })),
    getVenue: vi.fn(async () => VENUE),
  };
});

vi.mock("../src/api/users.js", () => ({ lookupUsers: vi.fn(async () => [{ id: ASSIGNED, displayName: "Coordinator One" }]) }));

const { App } = await import("../src/App.js");
const { createBookingRequest } = await import("../src/api/bookingRequests.js");

function signInAs(userId: string, role: string, path: string) {
  sessionStorage.setItem(
    "connectsphere.session",
    JSON.stringify({ userId, email: "user@connectsphere.test", role, token: "token", lastLoginAt: "2026-10-19T01:00:00.000Z" }),
  );
  window.location.hash = `#${path}`;
}

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.clearAllMocks();
});

const rowText = (row: HTMLElement) => row.textContent!.replace(/\s+/g, " ").trim();

describe("the event's holds (L3)", () => {
  it("lists each hold with its status, expiry and reminder, and offers the assigned coordinator a new hold (L3-T1, L3-T5)", async () => {
    signInAs(ASSIGNED, "EVENT_COORDINATOR", `/events/${EVENT_ID}/venue-requests`);
    render(<App />);

    const held = await screen.findByRole("row", { name: "HLD-000001" });
    expect(rowText(held)).toContain("Lee Kong Chian Auditorium");
    expect(rowText(held)).toContain("Wednesday 2 December 2026, 14:00–18:00");
    expect(rowText(held)).toContain("Held");
    expect(rowText(held)).toContain("Tuesday 1 December 2026, 18:00");
    expect(rowText(held)).toContain("1 day before");
    expect(rowText(screen.getByRole("row", { name: "HLD-000002" }))).toContain("Set when Venue Staff place it");
    expect(screen.getByRole("button", { name: "Request a hold" })).toBeTruthy();
    expect(within(held).getByRole("button", { name: "Convert to request" })).toBeTruthy();
    expect(within(screen.getByRole("row", { name: "HLD-000002" })).queryByRole("button", { name: "Convert to request" })).toBeNull();
  });

  it("offers a coordinator who isn't assigned no hold actions (L3-T2, L3-T15)", async () => {
    signInAs("someone-else", "EVENT_COORDINATOR", `/events/${EVENT_ID}/venue-requests`);
    render(<App />);
    await screen.findByRole("row", { name: "HLD-000001" });
    expect(screen.queryByRole("button", { name: "Request a hold" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Release" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Convert to request" })).toBeNull();
  });

  it("releases a hold after confirming, naming it (L3-T15)", async () => {
    signInAs(ASSIGNED, "EVENT_COORDINATOR", `/events/${EVENT_ID}/venue-requests`);
    render(<App />);
    const row = await screen.findByRole("row", { name: "HLD-000001" });
    fireEvent.click(within(row).getByRole("button", { name: "Release" }));
    expect(await screen.findByText("Release HLD-000001?")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Release hold" }));

    expect(await screen.findByText("HLD-000001 released.")).toBeTruthy();
    expect(releaseHold).toHaveBeenCalledWith("token", "hold-1");
  });
});

describe("the hold request form (L3)", () => {
  async function openForm() {
    signInAs(ASSIGNED, "EVENT_COORDINATOR", `/events/${EVENT_ID}/holds/new`);
    render(<App />);
    await screen.findByRole("heading", { name: "Request a hold" });
  }

  it("sends the venue, the period in Singapore time and the reminder, then shows the new hold (L3-T1)", async () => {
    await openForm();
    expect((screen.getByLabelText("Date") as HTMLInputElement).value).toBe("2026-12-02");
    fireEvent.change(screen.getByLabelText("Venue"), { target: { value: VENUE_ID } });

    fireEvent.click(screen.getByRole("button", { name: "Request hold" }));

    expect(await screen.findByText("Hold HLD-000003 requested.")).toBeTruthy();
    expect(requestHold).toHaveBeenCalledWith("token", {
      eventId: EVENT_ID,
      venueId: VENUE_ID,
      startsAt: "2026-12-02T14:00:00+08:00",
      endsAt: "2026-12-02T18:00:00+08:00",
      reminderLeadMinutes: 1440,
    });
  });

  it("shows a refused reminder under its field (L3-T4)", async () => {
    requestHold.mockRejectedValueOnce(
      new ApiError(400, {
        code: "VALIDATION_FAILED",
        message: "The hold could not be requested. Check the highlighted fields.",
        fields: [{ field: "reminderLeadMinutes", message: "Enter a whole number of minutes, at least 1." }],
        correlationId: null,
      }),
    );
    await openForm();
    fireEvent.change(screen.getByLabelText("Remind me this many minutes before it expires"), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Request hold" }));
    expect(await screen.findByText("Enter a whole number of minutes, at least 1.")).toBeTruthy();
    expect(requestHold.mock.calls[0]![1]).toMatchObject({ reminderLeadMinutes: 0 });
  });

  it("shows a refusal of the whole hold, such as a duplicate (L3-T11)", async () => {
    requestHold.mockRejectedValueOnce(
      new ApiError(409, {
        code: "HOLD_DUPLICATE",
        message: "This event already has hold HLD-000001 at Lee Kong Chian Auditorium. Release it, or convert it into a booking request, before holding the venue again.",
        correlationId: null,
      }),
    );
    await openForm();
    fireEvent.change(screen.getByLabelText("Venue"), { target: { value: VENUE_ID } });
    fireEvent.click(screen.getByRole("button", { name: "Request hold" }));
    expect(await screen.findByText(/already has hold HLD-000001/)).toBeTruthy();
  });
});

describe("converting a hold (L3-T13)", () => {
  it("fixes the venue and period to the hold's, and converts it with the chosen details", async () => {
    signInAs(ASSIGNED, "EVENT_COORDINATOR", `/events/${EVENT_ID}/venue-requests`);
    render(<App />);
    const row = await screen.findByRole("row", { name: "HLD-000001" });
    fireEvent.click(within(row).getByRole("button", { name: "Convert to request" }));

    await screen.findByRole("heading", { name: "Convert HLD-000001 into a request" });
    const venue = screen.getByLabelText("Venue") as HTMLSelectElement;
    expect(venue.disabled).toBe(true);
    expect((screen.getByLabelText("Date") as HTMLInputElement).disabled).toBe(true);
    await screen.findByRole("option", { name: "Theatre" });
    fireEvent.change(screen.getByLabelText("Room layout"), { target: { value: "Theatre" } });

    fireEvent.click(screen.getByRole("button", { name: "Submit request" }));

    expect(await screen.findByText("Booking request BKR-000009 submitted.")).toBeTruthy();
    expect(convertHold).toHaveBeenCalledWith("token", "hold-1", {
      layout: "Theatre",
      expectedAttendance: 150,
      facilities: ["Projector"],
      accessibilityFeatures: ["Step-free access"],
    });
    expect(createBookingRequest).not.toHaveBeenCalled();
  });
});

describe("the Venue Staff hold queue (L3)", () => {
  it("lists requested holds and places one with the chosen expiry (L3-T5)", async () => {
    signInAs("venue-staff", "VENUE_STAFF", "/holds");
    render(<App />);
    const row = await screen.findByRole("row", { name: "HLD-000001" });
    expect(rowText(row)).toContain("EVT-000123");
    expect(rowText(row)).toContain("1 day before");
    expect(screen.getByRole("link", { name: "Hold requests" })).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Expiry date for HLD-000001"), { target: { value: "2026-12-01" } });
    fireEvent.change(screen.getByLabelText("Expiry time for HLD-000001"), { target: { value: "18:00" } });
    fireEvent.click(within(row).getByRole("button", { name: "Place hold" }));

    expect(await screen.findByText("HLD-000001 placed. It expires on Tuesday 1 December 2026, 18:00.")).toBeTruthy();
    expect(placeHold).toHaveBeenCalledWith("token", "hold-1", "2026-12-01T18:00:00+08:00");
  });

  it("shows a refused expiry under it, and a conflict naming the other hold (L3-T6, L3-T8)", async () => {
    placeHold
      .mockRejectedValueOnce(
        new ApiError(400, {
          code: "VALIDATION_FAILED",
          message: "The hold could not be placed. Check the highlighted fields.",
          fields: [{ field: "expiresAt", message: "The expiry must be later than now." }],
          correlationId: null,
        }),
      )
      .mockRejectedValueOnce(
        new ApiError(409, {
          code: "VENUE_SLOT_CONFLICT",
          message: "This period overlaps HLD-000007 (Wednesday 2 December 2026, 14:00–18:00) at Lee Kong Chian Auditorium. A held or booked period can't be taken by another event.",
          correlationId: null,
        }),
      );
    signInAs("venue-staff", "VENUE_STAFF", "/holds");
    render(<App />);
    const row = await screen.findByRole("row", { name: "HLD-000001" });

    fireEvent.click(within(row).getByRole("button", { name: "Place hold" }));
    expect(await screen.findByText("The expiry must be later than now.")).toBeTruthy();
    fireEvent.click(within(row).getByRole("button", { name: "Place hold" }));
    expect(await screen.findByText(/overlaps HLD-000007/)).toBeTruthy();
  });

  it("gives coordinators no hold queue", async () => {
    signInAs(ASSIGNED, "EVENT_COORDINATOR", `/events/${EVENT_ID}/venue-requests`);
    render(<App />);
    await screen.findByRole("heading", { name: "Venue requests" });
    expect(screen.queryByRole("link", { name: "Hold requests" })).toBeNull();
  });
});
