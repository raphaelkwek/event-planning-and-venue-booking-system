import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

/** H2 — a venue's page: every attribute, laid out so each criterion can be seen. */

const VENUE_ID = "venue-1";

vi.mock("../src/api/venues.js", async () => {
  const actual = await vi.importActual<typeof import("../src/api/venues.js")>("../src/api/venues.js");
  const open = (opensAt: string, closesAt: string) => ({ opensAt, closesAt });
  return {
    ...actual,
    getVenue: vi.fn(async () => ({
      id: VENUE_ID,
      name: "Lee Kong Chian Auditorium",
      building: "School of Computing, Level 1",
      maxCapacity: 300,
      layouts: [
        { name: "Theatre", capacity: 300 },
        { name: "Classroom", capacity: 120 },
        { name: "Banquet", capacity: 180 },
      ],
      facilities: ["Projector", "Wireless microphones", "Stage lighting"],
      accessibilityFeatures: ["Step-free access", "Hearing loop", "Accessible toilet"],
      operatingHours: {
        monday: open("08:00", "22:00"),
        tuesday: open("08:00", "22:00"),
        wednesday: open("08:00", "22:00"),
        thursday: open("08:00", "22:00"),
        friday: open("08:00", "22:00"),
        saturday: open("09:00", "18:00"),
        sunday: null,
      },
      isActive: true,
      createdAt: "2026-10-04T01:00:00.000Z",
      createdBy: "venue-staff-id",
      updatedAt: "2026-10-04T01:00:00.000Z",
      updatedBy: "venue-staff-id",
    })),
  };
});

const { App } = await import("../src/App.js");
const { getVenue } = await import("../src/api/venues.js");

function signInAs(role: string) {
  sessionStorage.setItem(
    "connectsphere.session",
    JSON.stringify({ userId: "user-id", email: "user@connectsphere.test", role, token: "token", lastLoginAt: "2026-10-04T01:00:00.000Z" }),
  );
  window.location.hash = `#/venues/${VENUE_ID}`;
}

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.mocked(getVenue).mockClear();
});

const section = (name: string) => screen.getByRole("region", { name });

describe("a venue's page", () => {
  it("shows every catalogue attribute (H2 AC1)", async () => {
    signInAs("EVENT_COORDINATOR");
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Lee Kong Chian Auditorium" })).toBeTruthy();
    const summary = section("Summary").textContent!;
    for (const text of ["School of Computing, Level 1", "300", "Active"]) {
      expect(summary).toContain(text);
    }
    expect(within(section("Facilities")).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "Projector",
      "Wireless microphones",
      "Stage lighting",
    ]);
  });

  it("lists each accessibility feature on its own (H2 AC2)", async () => {
    signInAs("EVENT_COORDINATOR");
    render(<App />);
    await screen.findByRole("heading", { name: "Lee Kong Chian Auditorium" });
    expect(within(section("Accessibility features")).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "Step-free access",
      "Hearing loop",
      "Accessible toilet",
    ]);
  });

  it("shows each layout with its own capacity (H2 AC3)", async () => {
    signInAs("EVENT_COORDINATOR");
    render(<App />);
    await screen.findByRole("heading", { name: "Lee Kong Chian Auditorium" });
    const rows = within(section("Layouts")).getAllByRole("row").slice(1);
    expect(rows.map((row) => row.textContent)).toEqual(["Theatre300", "Classroom120", "Banquet180"]);
  });

  it("shows opening hours for each day of the week (H2 AC4)", async () => {
    signInAs("EVENT_COORDINATOR");
    render(<App />);
    await screen.findByRole("heading", { name: "Lee Kong Chian Auditorium" });
    const rows = within(section("Operating hours")).getAllByRole("row").slice(1);
    expect(rows.map((row) => row.textContent)).toEqual([
      "Monday08:00–22:00",
      "Tuesday08:00–22:00",
      "Wednesday08:00–22:00",
      "Thursday08:00–22:00",
      "Friday08:00–22:00",
      "Saturday09:00–18:00",
      "SundayClosed",
    ]);
  });

  it("offers Venue Staff, and only them, a way to edit", async () => {
    signInAs("VENUE_STAFF");
    render(<App />);
    expect(await screen.findByRole("button", { name: "Edit venue" })).toBeTruthy();
    cleanup();

    signInAs("TECH_SUPPORT_STAFF");
    render(<App />);
    await screen.findByRole("heading", { name: "Lee Kong Chian Auditorium" });
    expect(screen.queryByRole("button", { name: "Edit venue" })).toBeNull();
  });

  it("is not opened for an attendee, and no venue data is requested (H2 AC5)", async () => {
    signInAs("ATTENDEE");
    render(<App />);
    await screen.findByRole("button", { name: "Sign out" });
    expect(screen.queryByRole("heading", { name: "Lee Kong Chian Auditorium" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Venues" })).toBeNull();
    expect(getVenue).not.toHaveBeenCalled();
  });
});
