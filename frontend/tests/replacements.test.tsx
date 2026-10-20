import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

/**
 * L5 — the coordinator sees the event's bookings, finds a replacement for one an
 * unavailability block disrupts, and requests it linked to the disrupted booking.
 */

const EVENT_ID = "event-1";
const ASSIGNED = "assigned-coordinator";
const BOOKING_ID = "booking-1";
const HALL_ID = "venue-hall";

const EVENT = {
  id: EVENT_ID,
  reference: "EVT-000123",
  name: "Annual Research Symposium",
  status: "APPROVED",
  assignedCoordinatorId: ASSIGNED,
  proposedStartAt: "2026-12-02T06:00:00.000Z",
  proposedEndAt: "2026-12-02T10:00:00.000Z",
  expectedAttendance: 150,
  venueRequirements: { layout: "theatre", facilities: [], notes: null },
  accessibilityNeeds: null,
};

function booking(overrides: Record<string, unknown> = {}) {
  return {
    id: BOOKING_ID,
    reference: "BKR-000001",
    venueId: "venue-lkc",
    venueName: "Lee Kong Chian Auditorium",
    startsAt: "2026-12-02T06:00:00.000Z",
    endsAt: "2026-12-02T10:00:00.000Z",
    status: "CONFIRMED",
    requiresReconfirmation: true,
    releaseReason: null,
    disruptions: [
      { blockId: "block-1", reasonType: "MAINTENANCE", description: "Stage rigging inspection", startsAt: "2026-12-02T08:00:00.000Z", endsAt: "2026-12-02T11:00:00.000Z" },
    ],
    replacements: [],
    ...overrides,
  };
}

type Fn = (...args: unknown[]) => Promise<unknown>;
const listEventBookingRequests = vi.fn<Parameters<Fn>, ReturnType<Fn>>(async () => ({ event: EVENT, items: [], bookings: [booking()] }));
const createBookingRequest = vi.fn<Parameters<Fn>, ReturnType<Fn>>(async () => ({ reference: "BKR-000009" }));

vi.mock("../src/api/bookingRequests.js", async () => {
  const actual = await vi.importActual<typeof import("../src/api/bookingRequests.js")>("../src/api/bookingRequests.js");
  return {
    ...actual,
    listEventBookingRequests: (...args: unknown[]) => listEventBookingRequests(...args),
    createBookingRequest: (...args: unknown[]) => createBookingRequest(...args),
  };
});

const searchVenues = vi.fn<Parameters<Fn>, ReturnType<Fn>>(async () => ({
  items: [
    { id: HALL_ID, name: "Mochtar Riady Hall", building: "Business School", maxCapacity: 500, layoutCapacity: 500, facilities: ["Projector"], accessibilityFeatures: [] },
  ],
  appliedFilters: [],
  filters: { layout: "Theatre" },
  message: null,
}));

vi.mock("../src/api/venues.js", async () => {
  const actual = await vi.importActual<typeof import("../src/api/venues.js")>("../src/api/venues.js");
  return {
    ...actual,
    searchVenues: (...args: unknown[]) => searchVenues(...args),
    getSearchOptions: vi.fn(async () => ({ layouts: ["Theatre"], facilities: [], accessibilityFeatures: [] })),
    getSearchPrefill: vi.fn(async () => ({
      eventId: EVENT_ID,
      reference: "EVT-000123",
      filters: {
        from: "2026-12-02T06:00:00.000Z",
        to: "2026-12-02T10:00:00.000Z",
        minCapacity: 150,
        layout: "Theatre",
        facilities: [],
        accessibility: [],
      },
      unmatchedAccessibility: [],
    })),
    listVenues: vi.fn(async () => ({ items: [{ id: HALL_ID, name: "Mochtar Riady Hall", building: "Business School", maxCapacity: 500, isActive: true }] })),
    getVenue: vi.fn(async () => ({
      id: HALL_ID,
      name: "Mochtar Riady Hall",
      building: "Business School",
      maxCapacity: 500,
      layouts: [{ name: "Theatre", capacity: 500 }],
      facilities: [],
      accessibilityFeatures: [],
      operatingHours: {},
      isActive: true,
    })),
  };
});

vi.mock("../src/api/users.js", () => ({ lookupUsers: vi.fn(async () => []) }));

const { App } = await import("../src/App.js");

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

const text = (element: HTMLElement) => element.textContent!.replace(/\s+/g, " ").trim();
const bookingsTable = () => screen.findByRole("table", { name: "Bookings" });

describe("the event's bookings (L5-T1, L5-T2)", () => {
  it("shows a disrupted booking with what disrupts it, and offers the assigned coordinator Find a replacement", async () => {
    signInAs(ASSIGNED, "EVENT_COORDINATOR", `/events/${EVENT_ID}/venue-requests`);
    render(<App />);
    const row = within(await bookingsTable()).getByRole("row", { name: /BKR-000001/ });
    for (const part of [
      "Lee Kong Chian Auditorium",
      "Wednesday 2 December 2026, 14:00–18:00",
      "Confirmed",
      "Requires reconfirmation",
      "Unavailable: Maintenance, “Stage rigging inspection”, Wednesday 2 December 2026, 16:00–19:00",
    ]) {
      expect(text(row), part).toContain(part);
    }
    expect(within(row).getByRole("button", { name: "Find a replacement" })).toBeTruthy();
  });

  it("offers no action to the owner, nor on a booking no block disrupts, and shows a replaced booking released", async () => {
    listEventBookingRequests.mockResolvedValue({
      event: EVENT,
      items: [],
      bookings: [
        booking(),
        booking({ id: "booking-2", reference: "BKR-000002", requiresReconfirmation: false, disruptions: [] }),
        booking({ id: "booking-3", reference: "BKR-000003", status: "RELEASED", releaseReason: "replaced", disruptions: [] }),
      ],
    });
    signInAs(ASSIGNED, "EVENT_COORDINATOR", `/events/${EVENT_ID}/venue-requests`);
    render(<App />);
    const table = await bookingsTable();
    expect(within(within(table).getByRole("row", { name: /BKR-000002/ })).queryByRole("button")).toBeNull();
    const released = within(table).getByRole("row", { name: /BKR-000003/ });
    expect(text(released)).toContain("Released (replaced)");
    expect(within(released).queryByRole("button")).toBeNull();
    cleanup();

    signInAs("organiser", "EVENT_ORGANISER", `/events/${EVENT_ID}/venue-requests`);
    render(<App />);
    const ownerTable = await bookingsTable();
    expect(text(within(ownerTable).getByRole("row", { name: /BKR-000001/ }))).toContain("Requires reconfirmation");
    expect(screen.queryByRole("button", { name: "Find a replacement" })).toBeNull();
    listEventBookingRequests.mockReset();
    listEventBookingRequests.mockImplementation(async () => ({ event: EVENT, items: [], bookings: [booking()] }));
  });

  it("lists a booking's replacement requests with their status", async () => {
    listEventBookingRequests.mockResolvedValueOnce({
      event: EVENT,
      items: [],
      bookings: [booking({ replacements: [{ id: "request-9", reference: "BKR-000009", status: "PENDING", venueName: "Mochtar Riady Hall" }] })],
    });
    signInAs(ASSIGNED, "EVENT_COORDINATOR", `/events/${EVENT_ID}/venue-requests`);
    render(<App />);
    const row = within(await bookingsTable()).getByRole("row", { name: /BKR-000001/ });
    expect(text(row)).toContain("Replacement BKR-000009 at Mochtar Riady Hall: Pending");
  });
});

describe("finding and requesting a replacement (L5-T3, L5-T4)", () => {
  it("opens the search with the event's requirements and the disrupted booking's period, then requests a venue linked to it", async () => {
    signInAs(ASSIGNED, "EVENT_COORDINATOR", `/events/${EVENT_ID}/venue-requests`);
    render(<App />);
    const row = within(await bookingsTable()).getByRole("row", { name: /BKR-000001/ });
    fireEvent.click(within(row).getByRole("button", { name: "Find a replacement" }));

    expect(await screen.findByText(/Finding a replacement for BKR-000001 at Lee Kong Chian Auditorium/)).toBeTruthy();
    await waitFor(() => expect(searchVenues).toHaveBeenCalled());
    const searched = searchVenues.mock.calls[searchVenues.mock.calls.length - 1]![1] as Record<string, unknown>;
    expect(searched).toMatchObject({ from: "2026-12-02T14:00", to: "2026-12-02T18:00", minCapacity: "150", layout: "Theatre" });

    const results = await screen.findByRole("region", { name: "Results" });
    fireEvent.click(await within(results).findByRole("link", { name: "Request this venue" }));

    expect(await screen.findByText(/This request replaces BKR-000001 at Lee Kong Chian Auditorium/)).toBeTruthy();
    await waitFor(() => expect((screen.getByLabelText("Room layout") as HTMLSelectElement).value).toBe("Theatre"));
    expect((screen.getByLabelText("Venue") as HTMLSelectElement).value).toBe(HALL_ID);
    expect((screen.getByLabelText("Date") as HTMLInputElement).value).toBe("2026-12-02");
    expect((screen.getByLabelText("Start time") as HTMLInputElement).value).toBe("14:00");
    expect((screen.getByLabelText("End time") as HTMLInputElement).value).toBe("18:00");
    fireEvent.click(screen.getByRole("button", { name: "Submit request" }));

    await waitFor(() => expect(createBookingRequest).toHaveBeenCalled());
    expect(createBookingRequest.mock.calls[0]![1]).toMatchObject({
      eventId: EVENT_ID,
      venueId: HALL_ID,
      startsAt: "2026-12-02T14:00:00+08:00",
      endsAt: "2026-12-02T18:00:00+08:00",
      layout: "Theatre",
      replacesBookingId: BOOKING_ID,
    });
  });
});
