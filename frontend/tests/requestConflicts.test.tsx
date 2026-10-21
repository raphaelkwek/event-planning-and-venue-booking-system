import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

/**
 * N2 — a pending request that clashes with another pending request or a
 * confirmed booking at its venue is flagged "Conflict", naming each one and its
 * period: in Venue Staff's queue, and on the coordinator's own venue requests.
 */

const EVENT_ID = "event-1";
const ASSIGNED = "assigned-coordinator";

const EVENT = {
  id: EVENT_ID,
  reference: "EVT-000123",
  name: "Annual Research Symposium",
  status: "APPROVED",
  assignedCoordinatorId: ASSIGNED,
  proposedStartAt: "2026-12-02T06:00:00.000Z",
  proposedEndAt: "2026-12-02T10:00:00.000Z",
  expectedAttendance: 150,
  venueRequirements: null,
  accessibilityNeeds: null,
};

const CONFLICTS = [
  { kind: "BOOKING", reference: "N1-FX-EVT-000456", startsAt: "2026-12-02T05:00:00.000Z", endsAt: "2026-12-02T07:00:00.000Z" },
  { kind: "REQUEST", reference: "BKR-000002", startsAt: "2026-12-02T08:00:00.000Z", endsAt: "2026-12-02T12:00:00.000Z" },
];

function bookingRequest(overrides: Record<string, unknown> = {}) {
  return {
    id: "request-1",
    reference: "BKR-000001",
    eventId: EVENT_ID,
    eventReference: "EVT-000123",
    venueId: "venue-1",
    venueName: "Lee Kong Chian Auditorium",
    startsAt: "2026-12-02T06:00:00.000Z",
    endsAt: "2026-12-02T10:00:00.000Z",
    layout: "Theatre",
    expectedAttendance: 150,
    facilities: [],
    accessibilityFeatures: [],
    eventStartsAt: "2026-12-02T06:00:00.000Z",
    eventEndsAt: "2026-12-02T10:00:00.000Z",
    eventAttendance: 150,
    differsFromEvent: false,
    differences: [],
    replacesBookingId: null,
    status: "PENDING",
    requestedBy: ASSIGNED,
    requestedAt: "2026-10-17T02:00:00.000Z",
    withdrawnBy: null,
    withdrawnAt: null,
    decidedBy: null,
    decidedAt: null,
    bookingId: null,
    rejectionReason: null,
    suggestedAlternative: null,
    requiresReconfirmation: false,
    suitabilityStatus: null,
    suitabilityReasons: null,
    justification: null,
    conflicts: CONFLICTS,
    overlaps: [],
    ...overrides,
  };
}

type Fn = (...args: unknown[]) => Promise<unknown>;
const listBookingQueue = vi.fn<Parameters<Fn>, ReturnType<Fn>>(async () => ({
  items: [bookingRequest(), bookingRequest({ id: "request-3", reference: "BKR-000003", conflicts: [] })],
}));
const listEventBookingRequests = vi.fn<Parameters<Fn>, ReturnType<Fn>>(async () => ({
  event: EVENT,
  items: [bookingRequest(), bookingRequest({ id: "request-4", reference: "BKR-000004", status: "APPROVED", conflicts: [] })],
  bookings: [],
}));

vi.mock("../src/api/bookingRequests.js", async () => {
  const actual = await vi.importActual<typeof import("../src/api/bookingRequests.js")>("../src/api/bookingRequests.js");
  return {
    ...actual,
    listBookingQueue: (...args: unknown[]) => listBookingQueue(...args),
    listEventBookingRequests: (...args: unknown[]) => listEventBookingRequests(...args),
  };
});

vi.mock("../src/api/holds.js", async () => {
  const actual = await vi.importActual<typeof import("../src/api/holds.js")>("../src/api/holds.js");
  return { ...actual, listEventHolds: vi.fn(async () => ({ items: [] })) };
});

vi.mock("../src/api/users.js", () => ({ lookupUsers: vi.fn(async () => []) }));

const { App } = await import("../src/App.js");

function signInAs(userId: string, role: string, path: string) {
  sessionStorage.setItem(
    "connectsphere.session",
    JSON.stringify({ userId, email: "user@connectsphere.test", role, token: "token", lastLoginAt: "2026-10-21T01:00:00.000Z" }),
  );
  window.location.hash = `#${path}`;
}

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.clearAllMocks();
});

const text = (element: HTMLElement) => element.textContent!.replace(/\s+/g, " ").trim();
const LINES = [
  "Conflicts with N1-FX-EVT-000456 (confirmed booking), Wednesday 2 December 2026, 13:00–15:00",
  "Conflicts with BKR-000002 (pending request), Wednesday 2 December 2026, 16:00–20:00",
];

describe("Venue Staff's queue (N2-T1, N2-T2)", () => {
  it("flags a request that clashes, naming each booking and request with its period, and still offers both decisions", async () => {
    signInAs("venue-staff", "VENUE_STAFF", "/booking-requests");
    render(<App />);
    const row = await screen.findByRole("row", { name: /BKR-000001/ });
    expect(within(row).getByText("Conflict")).toBeTruthy();
    for (const line of LINES) expect(text(row), line).toContain(line);
    expect(within(row).getByRole("button", { name: "Approve" })).toBeTruthy();
    expect(within(row).getByRole("button", { name: "Reject" })).toBeTruthy();
  });

  it("shows no flag on a request that clashes with nothing (N2-T4)", async () => {
    signInAs("venue-staff", "VENUE_STAFF", "/booking-requests");
    render(<App />);
    const row = await screen.findByRole("row", { name: /BKR-000003/ });
    expect(within(row).queryByText("Conflict")).toBeNull();
    expect(text(row)).not.toContain("Conflicts with");
  });
});

describe("the coordinator's venue requests (N2-T5)", () => {
  it("shows the same flag on their own pending request, and none on a decided one", async () => {
    signInAs(ASSIGNED, "EVENT_COORDINATOR", `/events/${EVENT_ID}/venue-requests`);
    render(<App />);
    const row = await screen.findByRole("row", { name: /BKR-000001/ });
    expect(within(row).getByText("Conflict")).toBeTruthy();
    for (const line of LINES) expect(text(row), line).toContain(line);
    expect(within(screen.getByRole("row", { name: /BKR-000004/ })).queryByText("Conflict")).toBeNull();
  });
});

describe("the coordinator's venue requests (H3-T11)", () => {
  it("shows a pending request the venue's new times flagged, naming what it now overlaps", async () => {
    listEventBookingRequests.mockResolvedValueOnce({
      event: EVENT,
      items: [bookingRequest({ conflicts: [], requiresReconfirmation: true, overlaps: ["BKR-000009"] })],
      bookings: [],
    });
    signInAs(ASSIGNED, "EVENT_COORDINATOR", `/events/${EVENT_ID}/venue-requests`);
    render(<App />);
    const row = await screen.findByRole("row", { name: /BKR-000001/ });
    expect(within(row).getByText("Requires reconfirmation")).toBeTruthy();
    expect(text(row)).toContain("Overlaps BKR-000009 with the venue's new setup and turnaround time");
  });
});
