import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ApiError } from "../src/api/client.js";

/**
 * H1 — the venue editor as Venue Staff use it: typing into every kind of
 * field, and a refusal shown under the field that caused it.
 */

const STORED = {
  id: "venue-1",
  name: "Lee Kong Chian Auditorium",
  building: "School of Computing",
  maxCapacity: 300,
  layouts: [{ name: "Theatre", capacity: 300 }],
  facilities: [],
  accessibilityFeatures: [],
  operatingHours: { monday: null, tuesday: null, wednesday: null, thursday: null, friday: null, saturday: null, sunday: null },
  setupMinutes: 0,
  turnaroundMinutes: 0,
  isActive: true,
  createdAt: "2026-10-04T01:00:00.000Z",
  createdBy: "venue-staff-id",
  updatedAt: "2026-10-04T01:00:00.000Z",
  updatedBy: "venue-staff-id",
};

vi.mock("../src/api/venues.js", async () => {
  const actual = await vi.importActual<typeof import("../src/api/venues.js")>("../src/api/venues.js");
  return {
    ...actual,
    createVenue: vi.fn(async () => {
      throw new ApiError(400, {
        code: "VALIDATION_FAILED",
        message: "The venue could not be saved. Check the highlighted fields.",
        fields: [{ field: "maxCapacity", message: "Maximum capacity must be a whole number greater than zero." }],
        correlationId: null,
      });
    }),
    getVenue: vi.fn(async () => STORED),
    updateVenue: vi.fn(async () => ({ ...STORED, turnaroundMinutes: 30, flaggedBookings: [] })),
  };
});

const { App } = await import("../src/App.js");
const { createVenue, updateVenue } = await import("../src/api/venues.js");

beforeEach(() => {
  sessionStorage.setItem(
    "connectsphere.session",
    JSON.stringify({
      userId: "venue-staff-id",
      email: "venuestaff@connectsphere.test",
      role: "VENUE_STAFF",
      token: "token",
      lastLoginAt: "2026-10-04T01:00:00.000Z",
    }),
  );
  window.location.hash = "#/venues/new";
});

afterEach(() => {
  cleanup();
  sessionStorage.clear();
});

const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label, { exact: true }), { target: { value } });

describe("the venue editor", () => {
  it("keeps what is typed into text, number, list and time fields", async () => {
    render(<App />);
    await screen.findByRole("heading", { name: "New venue" });

    type("Name", "Lee Kong Chian Auditorium");
    type("Maximum capacity", "300");
    type("Layout 1", "Theatre");
    type("Facilities (one per line)", "Projector\nStage lighting");
    type("Monday opens", "09:00");

    expect((screen.getByLabelText("Name", { exact: true }) as HTMLInputElement).value).toBe("Lee Kong Chian Auditorium");
    expect((screen.getByLabelText("Maximum capacity") as HTMLInputElement).value).toBe("300");
    expect((screen.getByLabelText("Layout 1", { exact: true }) as HTMLInputElement).value).toBe("Theatre");
    expect((screen.getByLabelText("Facilities (one per line)") as HTMLTextAreaElement).value).toBe("Projector\nStage lighting");
    expect((screen.getByLabelText("Monday opens") as HTMLInputElement).value).toBe("09:00");
  });

  it("adds and removes layout rows", async () => {
    render(<App />);
    await screen.findByRole("heading", { name: "New venue" });
    fireEvent.click(screen.getByRole("button", { name: "Add layout" }));
    expect(screen.getByLabelText("Layout 2", { exact: true })).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Remove" })[0]!);
    fireEvent.click(screen.getAllByRole("button", { name: "Remove" })[0]!);
    expect(screen.queryByLabelText("Layout 1", { exact: true })).toBeNull();
  });

  it("shows a refusal's message under the field that caused it", async () => {
    render(<App />);
    await screen.findByRole("heading", { name: "New venue" });
    type("Maximum capacity", "0");
    fireEvent.click(screen.getByRole("button", { name: "Save venue" }));

    await waitFor(() => expect(createVenue).toHaveBeenCalled());
    const message = await screen.findByText("Maximum capacity must be a whole number greater than zero.");
    // Under the field: in the same block as the field's own label.
    expect(message.parentElement!.querySelector("label")!.textContent).toBe("Maximum capacity");
  });
});

describe("saving new setup or turnaround time (H3-T10)", () => {
  const text = (element: HTMLElement) => element.textContent!.replace(/\s+/g, " ").trim();

  it("lists each booking the new times flagged, with what it overlaps, and says nothing was moved", async () => {
    vi.mocked(updateVenue).mockResolvedValueOnce({
      ...STORED,
      turnaroundMinutes: 30,
      flaggedBookings: [
        { kind: "BOOKING", reference: "BKR-000001", eventReference: "EVT-000123", overlapsReferences: ["BKR-000002"] },
        { kind: "HOLD", reference: "BKR-000002", eventReference: "EVT-000456", overlapsReferences: ["BKR-000001"] },
        { kind: "REQUEST", reference: "BKR-000003", eventReference: "EVT-000789", overlapsReferences: ["BKR-000002"] },
      ],
    } as never);
    window.location.hash = "#/venues/venue-1/edit";
    render(<App />);
    await screen.findByRole("heading", { name: "Edit venue" });
    type("Turnaround time (minutes)", "30");
    fireEvent.click(screen.getByRole("button", { name: "Save venue" }));

    const notice = await screen.findByRole("region", { name: "Bookings that now overlap" });
    expect(text(notice)).toContain("Venue saved. With the new setup and turnaround time, these now overlap and require reconfirmation:");
    expect(text(notice)).toContain("Booking BKR-000001 (EVT-000123) overlaps BKR-000002");
    expect(text(notice)).toContain("Hold BKR-000002 (EVT-000456) overlaps BKR-000001");
    expect(text(notice)).toContain("Request BKR-000003 (EVT-000789) overlaps BKR-000002"); // H3-T11
    expect(text(notice)).toContain("Their coordinators have been told. Nothing was removed, released or moved.");
  });

  it("says only Venue saved when nothing was flagged", async () => {
    window.location.hash = "#/venues/venue-1/edit";
    render(<App />);
    await screen.findByRole("heading", { name: "Edit venue" });
    fireEvent.click(screen.getByRole("button", { name: "Save venue" }));

    expect(await screen.findByText("Venue saved.")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Bookings that now overlap" })).toBeNull();
  });
});
