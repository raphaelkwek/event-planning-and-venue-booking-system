import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { ApiError } from "../src/api/client.js";

/**
 * L6 — Venue Staff change a held hold's expiry, and expired holds show as
 * Expired, without actions, wherever holds are listed.
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
    remindedAt: null,
    expiredAt: null,
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
const listPlacedHolds = vi.fn<Parameters<Fn>, ReturnType<Fn>>(async () => ({ items: [] }));
const changeHoldExpiry = vi.fn<Parameters<Fn>, ReturnType<Fn>>(async () => hold({ expiresAt: "2026-12-01T12:00:00.000Z" }));
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
    listPlacedHolds: (...args: unknown[]) => listPlacedHolds(...args),
    placeHold: (...args: unknown[]) => placeHold(...args),
    changeHoldExpiry: (...args: unknown[]) => changeHoldExpiry(...args),
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

function signInAs(userId: string, role: string, path: string) {
  sessionStorage.setItem(
    "connectsphere.session",
    JSON.stringify({ userId, email: "user@connectsphere.test", role, token: "token", lastLoginAt: "2026-10-19T01:00:00.000Z" }),
  );
  window.location.hash = `#${path}`;
}

beforeEach(() => {
  // These tests are about placed holds, so the requested queue is empty.
  listHoldQueue.mockResolvedValue({ items: [] });
  listPlacedHolds.mockResolvedValue({ items: [] });
});

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.clearAllMocks();
});

const rowText = (row: HTMLElement) => row.textContent!.replace(/\s+/g, " ").trim();
const EXPIRED = { status: "EXPIRED", expiredAt: "2026-12-01T10:00:00.000Z", slotId: null };

describe("changing a hold's expiry (L6-T12)", () => {
  it("saves a new expiry from Change expiry and shows it", async () => {
    listPlacedHolds.mockResolvedValue({ items: [hold()] });
    signInAs("venue-staff", "VENUE_STAFF", "/holds");
    render(<App />);
    const row = await screen.findByRole("row", { name: "HLD-000001" });
    expect(rowText(row)).toContain("Tuesday 1 December 2026, 18:00");
    expect(within(row).queryByRole("button", { name: "Place hold" })).toBeNull();

    fireEvent.click(within(row).getByRole("button", { name: "Change expiry" }));
    fireEvent.change(screen.getByLabelText("New expiry date for HLD-000001"), { target: { value: "2026-12-01" } });
    fireEvent.change(screen.getByLabelText("New expiry time for HLD-000001"), { target: { value: "20:00" } });
    fireEvent.click(within(row).getByRole("button", { name: "Save" }));

    expect(await screen.findByText("HLD-000001 now expires on Tuesday 1 December 2026, 20:00.")).toBeTruthy();
    expect(changeHoldExpiry).toHaveBeenCalledWith("token", "hold-1", "2026-12-01T20:00:00+08:00");
  });

  it("shows a refused expiry inline and keeps the old one", async () => {
    changeHoldExpiry.mockRejectedValueOnce(
      new ApiError(400, {
        code: "VALIDATION_FAILED",
        message: "The expiry could not be changed. Check the highlighted fields.",
        fields: [{ field: "expiresAt", message: "The expiry must be later than now." }],
        correlationId: null,
      }),
    );
    listPlacedHolds.mockResolvedValue({ items: [hold()] });
    signInAs("venue-staff", "VENUE_STAFF", "/holds");
    render(<App />);
    const row = await screen.findByRole("row", { name: "HLD-000001" });
    fireEvent.click(within(row).getByRole("button", { name: "Change expiry" }));
    fireEvent.click(within(row).getByRole("button", { name: "Save" }));
    expect(await screen.findByText("The expiry must be later than now.")).toBeTruthy();
    expect(rowText(row)).toContain("Tuesday 1 December 2026, 18:00");
  });

  it("asks for the date and time when the field is cleared, without calling the server", async () => {
    listPlacedHolds.mockResolvedValue({ items: [hold()] });
    signInAs("venue-staff", "VENUE_STAFF", "/holds");
    render(<App />);
    const row = await screen.findByRole("row", { name: "HLD-000001" });
    fireEvent.click(within(row).getByRole("button", { name: "Change expiry" }));
    fireEvent.change(screen.getByLabelText("New expiry date for HLD-000001"), { target: { value: "" } });
    fireEvent.click(within(row).getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Enter the expiry date and time.")).toBeTruthy();
    expect(changeHoldExpiry).not.toHaveBeenCalled();
  });

  it("explains a hold that is no longer held", async () => {
    changeHoldExpiry.mockRejectedValueOnce(
      new ApiError(409, { code: "HOLD_NOT_HELD", message: "Only a held hold's expiry can be changed. HLD-000001 is Expired.", correlationId: null }),
    );
    listPlacedHolds.mockResolvedValue({ items: [hold()] });
    signInAs("venue-staff", "VENUE_STAFF", "/holds");
    render(<App />);
    const row = await screen.findByRole("row", { name: "HLD-000001" });
    fireEvent.click(within(row).getByRole("button", { name: "Change expiry" }));
    fireEvent.click(within(row).getByRole("button", { name: "Save" }));
    expect(await screen.findByText(/Only a held hold's expiry can be changed/)).toBeTruthy();
  });
});

describe("expired holds (L6-T12)", () => {
  it("shows Expired on <date and time> with no actions on Venue Staff's list", async () => {
    listPlacedHolds.mockResolvedValue({ items: [hold(EXPIRED)] });
    signInAs("venue-staff", "VENUE_STAFF", "/holds");
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Placed holds" })).toBeTruthy();
    const row = await screen.findByRole("row", { name: "HLD-000001" });
    expect(rowText(row)).toContain("Expired on Tuesday 1 December 2026, 18:00");
    expect(within(row).queryByRole("button")).toBeNull();
  });

  it("shows Expired and no Convert or Release on the coordinator's holds", async () => {
    listEventHolds.mockResolvedValue({ items: [hold(EXPIRED)] });
    signInAs(ASSIGNED, "EVENT_COORDINATOR", `/events/${EVENT_ID}/venue-requests`);
    render(<App />);
    const row = await screen.findByRole("row", { name: "HLD-000001" });
    expect(rowText(row)).toContain("Expired");
    expect(rowText(row)).toContain("Expired on Tuesday 1 December 2026, 18:00");
    expect(within(row).queryByRole("button")).toBeNull();
  });
});
