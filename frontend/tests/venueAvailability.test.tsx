import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { ApiError } from "../src/api/client.js";
import { CALENDAR_APPEARANCE } from "../src/shared/status.js";

/** I1 — a venue's availability calendar: each day's committed and free periods, read from the server. */

const VENUE_ID = "venue-1";
/** A Singapore time on a December 2026 day, as the server sends it (UTC). */
const at = (day: number, hhmm: string) => new Date(`2026-12-${String(day).padStart(2, "0")}T${hhmm}:00+08:00`).toISOString();
const period = (day: number, from: string, until: string) => ({
  startsAt: at(day, from),
  endsAt: until === "24:00" ? at(day + 1, "00:00") : at(day, until),
});

const MONDAY = {
  date: "2026-12-07",
  committed: [
    { kind: "OUTSIDE_HOURS", ...period(7, "00:00", "08:00") },
    { kind: "SETUP", ...period(7, "09:30", "10:00"), bookingStatus: "CONFIRMED", eventReference: "EVT-000101" },
    { kind: "BOOKING", ...period(7, "10:00", "12:00"), bookingStatus: "CONFIRMED", eventReference: "EVT-000101" },
    { kind: "TURNAROUND", ...period(7, "12:00", "12:30"), bookingStatus: "CONFIRMED", eventReference: "EVT-000101" },
    { kind: "BOOKING", ...period(7, "14:00", "16:00"), bookingStatus: "PENDING", eventReference: "EVT-000102" },
    { kind: "UNAVAILABLE", ...period(7, "18:00", "24:00"), reasonType: "RENOVATION", description: "Seat replacement" },
    { kind: "OUTSIDE_HOURS", ...period(7, "22:00", "24:00") },
  ],
  free: [period(7, "08:00", "09:30"), period(7, "12:30", "14:00"), period(7, "16:00", "18:00")],
};
const SUNDAY = { date: "2026-12-13", committed: [{ kind: "OUTSIDE_HOURS", ...period(13, "00:00", "24:00") }], free: [] };

vi.mock("../src/api/venues.js", async () => {
  const actual = await vi.importActual<typeof import("../src/api/venues.js")>("../src/api/venues.js");
  return {
    ...actual,
    getVenue: vi.fn(async () => ({
      id: VENUE_ID,
      name: "Lee Kong Chian Auditorium",
      building: "School of Computing, Level 1",
      maxCapacity: 300,
      layouts: [{ name: "Theatre", capacity: 300 }],
      facilities: [],
      accessibilityFeatures: [],
      operatingHours: Object.fromEntries(actual.DAYS.map((d) => [d, null])),
      isActive: true,
    })),
    getVenueAvailability: vi.fn(async (_token: string, _id: string, from: string, to: string) => ({
      venueId: VENUE_ID,
      timeZone: "Asia/Singapore",
      from,
      to,
      days: [MONDAY, SUNDAY],
    })),
  };
});

const { App } = await import("../src/App.js");
const { getVenueAvailability } = await import("../src/api/venues.js");

function signInAs(role: string, path = `/venues/${VENUE_ID}/availability`) {
  sessionStorage.setItem(
    "connectsphere.session",
    JSON.stringify({ userId: "user-id", email: "user@connectsphere.test", role, token: "token", lastLoginAt: "2026-10-07T01:00:00.000Z" }),
  );
  window.location.hash = `#${path}`;
}

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.mocked(getVenueAvailability).mockClear();
});

const day = (name: string) => screen.getByRole("region", { name });
const rows = (dayName: string, list: "Committed" | "Free") =>
  within(within(day(dayName)).getByRole("list", { name: list }))
    .getAllByRole("listitem")
    .map((li) => li.textContent!.replace(/\s+/g, " ").trim());

async function openCalendar(role = "EVENT_COORDINATOR") {
  signInAs(role);
  render(<App />);
  await screen.findByRole("region", { name: "Monday 7 December 2026" });
}

describe("a venue's availability calendar", () => {
  it("lists each day's committed and free periods in Singapore time (I1 AC1)", async () => {
    await openCalendar();
    expect(screen.getByRole("heading", { name: "Lee Kong Chian Auditorium" })).toBeTruthy();
    expect(rows("Monday 7 December 2026", "Free")).toEqual(["08:00–09:30", "12:30–14:00", "16:00–18:00"]);
    expect(rows("Monday 7 December 2026", "Committed")[0]).toBe("00:00–08:00 Outside operating hours");
  });

  it("labels a confirmed booking with its event reference (I1 AC2)", async () => {
    await openCalendar();
    expect(rows("Monday 7 December 2026", "Committed")).toContain("10:00–12:00 Confirmed EVT-000101");
  });

  it("labels a pending request as pending, in a different colour from a confirmed booking (I1 AC3)", async () => {
    await openCalendar();
    expect(rows("Monday 7 December 2026", "Committed")).toContain("14:00–16:00 Pending EVT-000102");
    expect(CALENDAR_APPEARANCE.PENDING).not.toBe(CALENDAR_APPEARANCE.CONFIRMED);
  });

  it("shows a block with its type and reason, ending at 24:00 (I1 AC4)", async () => {
    await openCalendar();
    expect(rows("Monday 7 December 2026", "Committed")).toContain("18:00–24:00 Renovation Seat replacement");
  });

  it("marks setup and turnaround as occupied, apart from the event (I1 AC5)", async () => {
    await openCalendar();
    const committed = rows("Monday 7 December 2026", "Committed");
    expect(committed).toContain("09:30–10:00 Setup EVT-000101 · occupied");
    expect(committed).toContain("12:00–12:30 Turnaround EVT-000101 · occupied");
    expect(CALENDAR_APPEARANCE.SETUP).not.toBe(CALENDAR_APPEARANCE.CONFIRMED);
    expect(CALENDAR_APPEARANCE.TURNAROUND).not.toBe(CALENDAR_APPEARANCE.PENDING);
  });

  it("shows a closed day as outside operating hours with no free periods (I1 AC6)", async () => {
    await openCalendar();
    expect(rows("Sunday 13 December 2026", "Committed")).toEqual(["00:00–24:00 Outside operating hours Closed all day"]);
    expect(within(day("Sunday 13 December 2026")).getByText("No free periods")).toBeTruthy();
  });

  it("asks the server again for the dates chosen when Show is clicked (I1 AC1, AC7)", async () => {
    await openCalendar();
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-12-07" } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-12-13" } });
    fireEvent.click(screen.getByRole("button", { name: "Show" }));
    await vi.waitFor(() =>
      expect(getVenueAvailability).toHaveBeenLastCalledWith("token", VENUE_ID, "2026-12-07", "2026-12-13"),
    );
  });

  it("shows a refused range next to the dates, and no calendar", async () => {
    await openCalendar();
    vi.mocked(getVenueAvailability).mockRejectedValueOnce(
      new ApiError(400, {
        code: "VALIDATION_FAILED",
        message: "The calendar could not be shown. Check the dates.",
        fields: [{ field: "to", message: "A range can be at most 31 days; this one is 32." }],
        correlationId: null,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Show" }));

    expect(await screen.findByText("A range can be at most 31 days; this one is 32.")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Monday 7 December 2026" })).toBeNull();
  });

  it("is reached from a venue's page", async () => {
    signInAs("TECH_SUPPORT_STAFF", `/venues/${VENUE_ID}`);
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Availability" }));
    expect(await screen.findByRole("region", { name: "Monday 7 December 2026" })).toBeTruthy();
  });

  it("is not opened for an attendee, and nothing is requested (I1 AC8)", async () => {
    signInAs("ATTENDEE");
    render(<App />);
    await screen.findByRole("button", { name: "Sign out" });
    expect(screen.queryByLabelText("From")).toBeNull();
    expect(getVenueAvailability).not.toHaveBeenCalled();
  });
});
