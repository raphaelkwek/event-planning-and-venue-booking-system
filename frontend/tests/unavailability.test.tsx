import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ApiError } from "../src/api/client.js";

/**
 * I2 — the venue's Venue Staff record a period of unavailability after reviewing
 * what it would disrupt, see the venue's active blocks, and remove one. A
 * coordinator sees a disrupted request flagged Requires reconfirmation.
 */

const VENUE_ID = "venue-1";
const EVENT_ID = "event-1";

function block(overrides: Record<string, unknown> = {}) {
  return {
    id: "block-1",
    venueId: VENUE_ID,
    startsAt: "2026-12-02T08:00:00.000Z",
    endsAt: "2026-12-02T11:00:00.000Z",
    reasonType: "MAINTENANCE",
    description: "Stage rigging inspection",
    status: "ACTIVE",
    createdBy: "venue-staff",
    createdAt: "2026-10-19T02:00:00.000Z",
    removedBy: null,
    removedAt: null,
    ...overrides,
  };
}

const DISRUPTED = [
  { kind: "BOOKING", reference: "BKR-000001", eventReference: "EVT-000123", overlapFrom: "2026-12-02T08:00:00.000Z", overlapUntil: "2026-12-02T10:00:00.000Z" },
];

type Fn = (...args: unknown[]) => Promise<unknown>;
const listBlocks = vi.fn<Parameters<Fn>, ReturnType<Fn>>(async () => ({ items: [] }));
const reviewBlock = vi.fn<Parameters<Fn>, ReturnType<Fn>>(async () => ({ items: DISRUPTED }));
const recordBlock = vi.fn<Parameters<Fn>, ReturnType<Fn>>(async () => ({ block: block(), disrupted: DISRUPTED }));
const removeBlock = vi.fn<Parameters<Fn>, ReturnType<Fn>>(async () => ({ block: block({ status: "REMOVED" }), cleared: [] }));

vi.mock("../src/api/unavailability.js", async () => {
  const actual = await vi.importActual<typeof import("../src/api/unavailability.js")>("../src/api/unavailability.js");
  return {
    ...actual,
    listBlocks: (...args: unknown[]) => listBlocks(...args),
    reviewBlock: (...args: unknown[]) => reviewBlock(...args),
    recordBlock: (...args: unknown[]) => recordBlock(...args),
    removeBlock: (...args: unknown[]) => removeBlock(...args),
  };
});

vi.mock("../src/api/venues.js", async () => {
  const actual = await vi.importActual<typeof import("../src/api/venues.js")>("../src/api/venues.js");
  return {
    ...actual,
    getVenue: vi.fn(async () => ({
      id: VENUE_ID,
      name: "Lee Kong Chian Auditorium",
      building: "School of Computing",
      maxCapacity: 300,
      layouts: [{ name: "Theatre", capacity: 300 }],
      facilities: [],
      accessibilityFeatures: [],
      operatingHours: {},
      isActive: true,
    })),
  };
});

const listEventBookingRequests = vi.fn<Parameters<Fn>, ReturnType<Fn>>();
vi.mock("../src/api/bookingRequests.js", async () => {
  const actual = await vi.importActual<typeof import("../src/api/bookingRequests.js")>("../src/api/bookingRequests.js");
  return { ...actual, listEventBookingRequests: (...args: unknown[]) => listEventBookingRequests(...args) };
});

// L3: the event's venue requests page also lists its holds; tests/holds.test.tsx covers them.
vi.mock("../src/api/holds.js", async () => {
  const actual = await vi.importActual<typeof import("../src/api/holds.js")>("../src/api/holds.js");
  return { ...actual, listEventHolds: vi.fn(async () => ({ items: [] })) };
});

vi.mock("../src/api/users.js", () => ({ lookupUsers: vi.fn(async () => [{ id: "venue-staff", displayName: "Venue Staff One" }]) }));

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

async function openScreen() {
  signInAs("venue-staff", "VENUE_STAFF", `/venues/${VENUE_ID}/unavailability`);
  render(<App />);
  await screen.findByRole("heading", { name: "Unavailability" });
}

function fill(values: Partial<Record<"Start date" | "Start time" | "End date" | "End time" | "Description", string>> & { reason?: string }) {
  for (const [label, value] of Object.entries(values)) {
    if (label === "reason") fireEvent.change(screen.getByLabelText("Reason type"), { target: { value } });
    else fireEvent.change(screen.getByLabelText(label), { target: { value } });
  }
}

const WHOLE = { "Start date": "2026-12-02", "Start time": "16:00", "End date": "2026-12-02", "End time": "19:00", reason: "MAINTENANCE", Description: "Stage rigging inspection" };

describe("recording unavailability (I2)", () => {
  it("is reached from the venue's page by its Venue Staff", async () => {
    signInAs("venue-staff", "VENUE_STAFF", `/venues/${VENUE_ID}`);
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Unavailability" }));
    expect(await screen.findByRole("heading", { name: "Unavailability" })).toBeTruthy();
  });

  it("offers CR-02's five reason types", async () => {
    await openScreen();
    const options = within(screen.getByLabelText("Reason type")).getAllByRole("option").map((o) => o.textContent);
    expect(options).toEqual(["Choose…", "Maintenance", "Equipment failure", "Renovation", "Safety concern", "Other operational reason"]);
  });

  it("names every missing field, and a description of only spaces, without reviewing anything (I2-T2)", async () => {
    await openScreen();
    fireEvent.click(screen.getByRole("button", { name: "Review" }));
    for (const message of ["Enter the start date and time.", "Enter the end date and time.", "Choose a reason type.", "Enter a description."]) {
      expect(screen.getByText(message), message).toBeTruthy();
    }
    fill({ ...WHOLE, reason: "", Description: "   " });
    fireEvent.click(screen.getByRole("button", { name: "Review" }));
    expect(screen.getByText("Choose a reason type.")).toBeTruthy();
    expect(screen.getByText("Enter a description.")).toBeTruthy();
    expect(screen.queryByText("Enter the start date and time.")).toBeNull();
    expect(reviewBlock).not.toHaveBeenCalled();
  });

  it("refuses an end at or before the start, under the end (I2-T3)", async () => {
    await openScreen();
    fill({ ...WHOLE, "Start time": "13:00", "End time": "13:00" });
    fireEvent.click(screen.getByRole("button", { name: "Review" }));
    expect(screen.getByText("The end must be after the start.")).toBeTruthy();
    expect(reviewBlock).not.toHaveBeenCalled();
  });

  it("lists what the block would disrupt before recording it, then records it (I2-T4, I2-T6)", async () => {
    await openScreen();
    fill(WHOLE);
    fireEvent.click(screen.getByRole("button", { name: "Review" }));

    const dialog = await screen.findByRole("dialog");
    expect(reviewBlock).toHaveBeenCalledWith("token", VENUE_ID, "2026-12-02T16:00:00+08:00", "2026-12-02T19:00:00+08:00");
    expect(text(dialog)).toContain("Booking BKR-000001 for EVT-000123, Wednesday 2 December 2026, 16:00–18:00");
    expect(recordBlock).not.toHaveBeenCalled();

    listBlocks.mockResolvedValueOnce({ items: [block()] });
    fireEvent.click(within(dialog).getByRole("button", { name: "Record unavailability" }));

    expect(await screen.findByText("Unavailability recorded. 1 booking now requires reconfirmation.")).toBeTruthy();
    expect(recordBlock).toHaveBeenCalledWith("token", VENUE_ID, {
      startsAt: "2026-12-02T16:00:00+08:00",
      endsAt: "2026-12-02T19:00:00+08:00",
      reasonType: "MAINTENANCE",
      description: "Stage rigging inspection",
    });
    const row = await screen.findByRole("row", { name: /Stage rigging inspection/ });
    expect(text(row)).toContain("Wednesday 2 December 2026, 16:00–19:00");
    expect(text(row)).toContain("Maintenance");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("says when nothing is disrupted (I2-T1)", async () => {
    reviewBlock.mockResolvedValueOnce({ items: [] });
    recordBlock.mockResolvedValueOnce({ block: block(), disrupted: [] });
    await openScreen();
    fill(WHOLE);
    fireEvent.click(screen.getByRole("button", { name: "Review" }));
    const dialog = await screen.findByRole("dialog");
    expect(text(dialog)).toContain("Nothing is booked, held or requested in this period.");
    fireEvent.click(within(dialog).getByRole("button", { name: "Record unavailability" }));
    expect(await screen.findByText("Unavailability recorded.")).toBeTruthy();
  });

  it("shows the server's refusal in the dialog, and records nothing more", async () => {
    recordBlock.mockRejectedValueOnce(
      new ApiError(400, { code: "VALIDATION_FAILED", message: "The unavailability could not be recorded. Check the highlighted fields.", correlationId: null }),
    );
    await openScreen();
    fill(WHOLE);
    fireEvent.click(screen.getByRole("button", { name: "Review" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Record unavailability" }));
    expect(await within(dialog).findByText(/could not be recorded/)).toBeTruthy();
  });
});

describe("removing unavailability (I2-T11)", () => {
  it("confirms, removes the block, and refreshes the list", async () => {
    listBlocks.mockResolvedValueOnce({ items: [block()] });
    await openScreen();
    const row = await screen.findByRole("row", { name: /Stage rigging inspection/ });
    fireEvent.click(within(row).getByRole("button", { name: "Remove" }));
    const dialog = await screen.findByRole("dialog");
    expect(text(dialog)).toContain("Wednesday 2 December 2026, 16:00–19:00");
    listBlocks.mockResolvedValueOnce({ items: [] });
    fireEvent.click(within(dialog).getByRole("button", { name: "Remove unavailability" }));

    expect(await screen.findByText("Unavailability removed.")).toBeTruthy();
    expect(removeBlock).toHaveBeenCalledWith("token", VENUE_ID, "block-1");
    expect(await screen.findByText("No unavailability is recorded for this venue.")).toBeTruthy();
  });
});

describe("a disrupted request (I2-T9)", () => {
  it("is shown to its coordinator as requiring reconfirmation", async () => {
    listEventBookingRequests.mockResolvedValueOnce({
      event: {
        id: EVENT_ID,
        reference: "EVT-000123",
        name: "Annual Research Symposium",
        status: "APPROVED",
        assignedCoordinatorId: "coordinator",
        proposedStartAt: "2026-12-02T06:00:00.000Z",
        proposedEndAt: "2026-12-02T10:00:00.000Z",
        expectedAttendance: 150,
        venueRequirements: null,
        accessibilityNeeds: null,
      },
      items: [
        {
          id: "request-1",
          reference: "BKR-000001",
          eventId: EVENT_ID,
          eventReference: "EVT-000123",
          venueId: VENUE_ID,
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
          requestedBy: "coordinator",
          requestedAt: "2026-10-17T02:00:00.000Z",
          withdrawnBy: null,
          withdrawnAt: null,
          decidedBy: null,
          decidedAt: null,
          bookingId: null,
          rejectionReason: null,
          suggestedAlternative: null,
          requiresReconfirmation: true,
          conflicts: [],
          overlaps: [],
        },
      ],
    });
    signInAs("coordinator", "EVENT_COORDINATOR", `/events/${EVENT_ID}/venue-requests`);
    render(<App />);
    const row = await screen.findByRole("row", { name: /BKR-000001/ });
    expect(text(row)).toContain("Requires reconfirmation");
  });
});
