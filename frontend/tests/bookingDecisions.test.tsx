import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ApiError } from "../src/api/client.js";

/**
 * M1, M2 — Venue Staff approve or reject a request from their queue, and the
 * coordinator sees the decision, with any reason and suggestion, on the event's
 * venue requests.
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
    conflicts: [],
    overlaps: [],
    ...overrides,
  };
}

type Fn = (...args: unknown[]) => Promise<unknown>;
const listBookingQueue = vi.fn<Parameters<Fn>, ReturnType<Fn>>(async () => ({ items: [bookingRequest()] }));
const approveBookingRequest = vi.fn<Parameters<Fn>, ReturnType<Fn>>(async () => bookingRequest({ status: "APPROVED" }));
const rejectBookingRequest = vi.fn<Parameters<Fn>, ReturnType<Fn>>(async () => bookingRequest({ status: "REJECTED" }));
const listEventBookingRequests = vi.fn<Parameters<Fn>, ReturnType<Fn>>(async () => ({ event: EVENT, items: [] }));

vi.mock("../src/api/bookingRequests.js", async () => {
  const actual = await vi.importActual<typeof import("../src/api/bookingRequests.js")>("../src/api/bookingRequests.js");
  return {
    ...actual,
    listBookingQueue: (...args: unknown[]) => listBookingQueue(...args),
    approveBookingRequest: (...args: unknown[]) => approveBookingRequest(...args),
    rejectBookingRequest: (...args: unknown[]) => rejectBookingRequest(...args),
    listEventBookingRequests: (...args: unknown[]) => listEventBookingRequests(...args),
  };
});

// L3: the event's venue requests page also lists its holds; tests/holds.test.tsx covers them.
vi.mock("../src/api/holds.js", async () => {
  const actual = await vi.importActual<typeof import("../src/api/holds.js")>("../src/api/holds.js");
  return { ...actual, listEventHolds: vi.fn(async () => ({ items: [] })) };
});

vi.mock("../src/api/users.js", () => ({ lookupUsers: vi.fn(async () => [{ id: ASSIGNED, displayName: "Coordinator One" }]) }));

const { App } = await import("../src/App.js");

function signInAs(userId: string, role: string, path: string) {
  sessionStorage.setItem(
    "connectsphere.session",
    JSON.stringify({ userId, email: "user@connectsphere.test", role, token: "token", lastLoginAt: "2026-10-17T01:00:00.000Z" }),
  );
  window.location.hash = `#${path}`;
}

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.clearAllMocks();
});

const rowText = (row: HTMLElement) => row.textContent!.replace(/\s+/g, " ").trim();

async function openQueue() {
  signInAs("venue-staff", "VENUE_STAFF", "/booking-requests");
  render(<App />);
  return screen.findByRole("row", { name: /BKR-000001/ });
}

describe("approving from the queue (M1)", () => {
  it("offers Approve and Reject on each request, with the requesting coordinator's name (M1-T1)", async () => {
    const row = await openQueue();
    expect(within(row).getByRole("button", { name: "Approve" })).toBeTruthy();
    expect(within(row).getByRole("button", { name: "Reject" })).toBeTruthy();
    expect(await within(row).findByText("Coordinator One")).toBeTruthy();
  });

  it("confirms naming the request, venue and period, then approves and refreshes the queue (M1-T3)", async () => {
    const row = await openQueue();
    fireEvent.click(within(row).getByRole("button", { name: "Approve" }));

    const dialog = await screen.findByRole("dialog");
    expect(rowText(dialog)).toContain("BKR-000001");
    expect(rowText(dialog)).toContain("Lee Kong Chian Auditorium, Wednesday 2 December 2026, 14:00–18:00");
    listBookingQueue.mockResolvedValueOnce({ items: [] });
    fireEvent.click(within(dialog).getByRole("button", { name: "Approve request" }));

    expect(await screen.findByText("BKR-000001 approved. The booking is confirmed.")).toBeTruthy();
    expect(approveBookingRequest).toHaveBeenCalledWith("token", "request-1");
    expect(await screen.findByText("No booking request is waiting.")).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("shows a refused approval in the dialog, and keeps the request listed (M1-T4, M1-T5)", async () => {
    approveBookingRequest.mockRejectedValueOnce(
      new ApiError(409, {
        code: "VENUE_SLOT_CONFLICT",
        message: "BKR-000001 wasn't approved: Lee Kong Chian Auditorium is already booked for EVT-000456. Nothing was approved.",
        correlationId: null,
      }),
    );
    const row = await openQueue();
    fireEvent.click(within(row).getByRole("button", { name: "Approve" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Approve request" }));

    expect(await within(dialog).findByText(/already booked for EVT-000456/)).toBeTruthy();
    expect(screen.getByRole("row", { name: /BKR-000001/ })).toBeTruthy();
    expect(screen.queryByText(/approved\. The booking is confirmed/)).toBeNull();
  });
});

describe("rejecting from the queue (M2)", () => {
  async function openRejection() {
    const row = await openQueue();
    fireEvent.click(within(row).getByRole("button", { name: "Reject" }));
    return screen.findByRole("dialog");
  }

  it("requires a reason that isn't only spaces, under the Reason field, and sends nothing without one (M2-T1)", async () => {
    const dialog = await openRejection();
    fireEvent.click(within(dialog).getByRole("button", { name: "Reject request" }));
    expect(await within(dialog).findByText("Enter the reason for rejecting the request.")).toBeTruthy();

    fireEvent.change(within(dialog).getByLabelText(/^Reason/), { target: { value: "   " } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Reject request" }));
    expect(within(dialog).getByText("Enter the reason for rejecting the request.")).toBeTruthy();
    expect(rejectBookingRequest).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByLabelText(/^Reason/), { target: { value: "X" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Reject request" }));
    expect(await screen.findByText("BKR-000001 rejected.")).toBeTruthy();
    expect(rejectBookingRequest).toHaveBeenCalledWith("token", "request-1", { reason: "X", suggestion: null });
  });

  it("sends the reason and the suggested alternative (M2-T2, M2-T3)", async () => {
    const dialog = await openRejection();
    fireEvent.change(within(dialog).getByLabelText(/^Reason/), { target: { value: "Already promised to another faculty" } });
    fireEvent.change(within(dialog).getByLabelText(/^Suggested alternative/), { target: { value: "Seminar Room 2-1" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Reject request" }));

    await screen.findByText("BKR-000001 rejected.");
    expect(rejectBookingRequest).toHaveBeenCalledWith("token", "request-1", {
      reason: "Already promised to another faculty",
      suggestion: "Seminar Room 2-1",
    });
  });

  it("shows the server's refusal of the reason under the field", async () => {
    rejectBookingRequest.mockRejectedValueOnce(
      new ApiError(400, {
        code: "VALIDATION_FAILED",
        message: "The request could not be rejected. Check the highlighted fields.",
        fields: [{ field: "reason", message: "Keep the reason to 1000 characters or fewer." }],
        correlationId: null,
      }),
    );
    const dialog = await openRejection();
    fireEvent.change(within(dialog).getByLabelText(/^Reason/), { target: { value: "Too long" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Reject request" }));
    expect((await within(dialog).findAllByText("Keep the reason to 1000 characters or fewer.")).length).toBeGreaterThan(0);
  });
});

describe("the coordinator sees the decision (M2-T2, M2-T3)", () => {
  it("shows a rejected request's reason and suggestion, and an approved request as Approved", async () => {
    listEventBookingRequests.mockResolvedValueOnce({
      event: EVENT,
      items: [
        bookingRequest({ status: "REJECTED", rejectionReason: "Already promised to another faculty", suggestedAlternative: "Seminar Room 2-1" }),
        bookingRequest({ id: "request-2", reference: "BKR-000002", status: "APPROVED" }),
      ],
    });
    signInAs(ASSIGNED, "EVENT_COORDINATOR", `/events/${EVENT_ID}/venue-requests`);
    render(<App />);

    const rejected = rowText(await screen.findByRole("row", { name: /BKR-000001/ }));
    expect(rejected).toContain("Rejected");
    expect(rejected).toContain("Reason: Already promised to another faculty");
    expect(rejected).toContain("Suggested alternative: Seminar Room 2-1");
    const approved = rowText(screen.getByRole("row", { name: /BKR-000002/ }));
    expect(approved).toContain("Approved");
    expect(approved).not.toContain("Reason:");
  });
});
