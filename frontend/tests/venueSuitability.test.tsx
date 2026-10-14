import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ApiError } from "../src/api/client.js";

/** K1 — whether a venue suits an event: the result, its reasons, and who can reach the screen. */

const VENUE_ID = "venue-1";
const EVENT_ID = "event-1";

const NOT_SUITABLE = {
  venueId: VENUE_ID,
  venueName: "K1 Test Hall",
  eventId: EVENT_ID,
  eventReference: "EVT-000101",
  status: "NOT_SUITABLE",
  reasons: [
    {
      condition: "LAYOUT_CAPACITY",
      outcome: "FAILED",
      required: 150,
      available: 120,
      message: "Expected attendance 150 against layout capacity 120 (Theatre).",
    },
    {
      condition: "FACILITIES",
      outcome: "FAILED",
      required: ["Simultaneous interpretation"],
      available: ["Projector"],
      missing: ["Simultaneous interpretation"],
      message: "Required facility absent: Simultaneous interpretation. The venue offers: Projector.",
    },
  ],
  warnings: [],
};

vi.mock("../src/api/venues.js", async () => {
  const actual = await vi.importActual<typeof import("../src/api/venues.js")>("../src/api/venues.js");
  return {
    ...actual,
    getVenue: vi.fn(async () => ({
      id: VENUE_ID,
      name: "K1 Test Hall",
      building: "K1 Building",
      maxCapacity: 120,
      layouts: [{ name: "Theatre", capacity: 120 }],
      facilities: [],
      accessibilityFeatures: [],
      operatingHours: Object.fromEntries(actual.DAYS.map((d) => [d, null])),
      isActive: true,
    })),
    getVenueSuitability: vi.fn(async () => NOT_SUITABLE),
  };
});

vi.mock("../src/api/events.js", async () => {
  const actual = await vi.importActual<typeof import("../src/api/events.js")>("../src/api/events.js");
  return {
    ...actual,
    listRequests: vi.fn(async () => ({
      items: [
        { id: EVENT_ID, kind: "EVENT", status: "PLANNING", name: "Research Symposium", reference: "EVT-000101" },
        { id: "draft-1", kind: "DRAFT", status: "DRAFT", name: "My unfinished draft", reference: null },
      ],
      nextCursor: null,
    })),
  };
});

const { App } = await import("../src/App.js");
const { getVenueSuitability } = await import("../src/api/venues.js");

function signInAs(role: string, path = `/venues/${VENUE_ID}/suitability`) {
  sessionStorage.setItem(
    "connectsphere.session",
    JSON.stringify({ userId: "user-id", email: "user@connectsphere.test", role, token: "token", lastLoginAt: "2026-10-10T01:00:00.000Z" }),
  );
  window.location.hash = `#${path}`;
}

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.mocked(getVenueSuitability).mockClear();
  vi.mocked(getVenueSuitability).mockImplementation(async () => NOT_SUITABLE as never);
});

async function check() {
  signInAs("EVENT_COORDINATOR");
  render(<App />);
  const choice = await screen.findByLabelText("Event");
  await screen.findByRole("option", { name: "EVT-000101 · Research Symposium" });
  fireEvent.change(choice, { target: { value: EVENT_ID } });
  fireEvent.click(screen.getByRole("button", { name: "Check suitability" }));
}

describe("the suitability screen", () => {
  it("shows Not suitable with each failing condition listed separately, values included (K1 AC1 to AC3)", async () => {
    await check();

    expect((await screen.findByRole("status")).textContent).toBe("Not suitable");
    const reasons = within(screen.getByRole("list", { name: "Reasons" })).getAllByRole("listitem");
    expect(reasons.map((li) => li.textContent)).toEqual([
      "Expected attendance 150 against layout capacity 120 (Theatre).",
      "Required facility absent: Simultaneous interpretation. The venue offers: Projector.",
    ]);
    expect(getVenueSuitability).toHaveBeenCalledWith("token", VENUE_ID, EVENT_ID);
  });

  it("offers submitted events to choose from, not drafts, and asks for nothing else (K1 AC4)", async () => {
    signInAs("EVENT_COORDINATOR");
    render(<App />);

    await screen.findByRole("option", { name: "EVT-000101 · Research Symposium" });

    expect(screen.queryByRole("option", { name: /unfinished draft/ })).toBeNull();
    expect(screen.getAllByRole("combobox")).toHaveLength(1);
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    expect(screen.queryAllByRole("spinbutton")).toHaveLength(0);
  });

  it("cannot check until an event is chosen", async () => {
    signInAs("EVENT_COORDINATOR");
    render(<App />);
    await screen.findByRole("option", { name: "EVT-000101 · Research Symposium" });

    expect((screen.getByRole("button", { name: "Check suitability" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows Suitable and lists no reasons (K1 AC6)", async () => {
    vi.mocked(getVenueSuitability).mockImplementation(async () => ({ ...NOT_SUITABLE, status: "SUITABLE", reasons: [], warnings: [] }) as never);

    await check();

    expect((await screen.findByRole("status")).textContent).toBe("Suitable");
    expect(screen.queryByRole("list", { name: "Reasons" })).toBeNull();
    expect(screen.queryByRole("list", { name: "Warnings" })).toBeNull();
  });

  it("shows Suitable with warnings, listing what could not be assessed apart from any reasons (K1 AC1)", async () => {
    vi.mocked(getVenueSuitability).mockImplementation(
      async () =>
        ({
          ...NOT_SUITABLE,
          status: "SUITABLE_WITH_WARNINGS",
          reasons: [],
          warnings: [
            { condition: "OPERATING_HOURS", outcome: "NOT_ASSESSED", required: null, available: null, message: "The event records no proposed period, so it was not compared with the venue's operating hours." },
          ],
        }) as never,
    );

    await check();

    expect((await screen.findByRole("status")).textContent).toBe("Suitable with warnings");
    expect(screen.queryByRole("list", { name: "Reasons" })).toBeNull();
    expect(within(screen.getByRole("list", { name: "Warnings" })).getAllByRole("listitem")).toHaveLength(1);
  });

  it("shows the server's refusal in its own words and no result", async () => {
    vi.mocked(getVenueSuitability).mockRejectedValue(
      new ApiError(404, { code: "EVENT_NOT_FOUND", message: "No event with that id exists.", correlationId: null }),
    );

    await check();

    expect(await screen.findByText("No event with that id exists.")).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("is advisory: offers no way to request, hold or block a booking (K1 AC5)", async () => {
    await check();
    await screen.findByRole("status");

    const buttons = screen.getAllByRole("button").map((button) => button.textContent);
    expect(buttons.sort()).toEqual(["Back to venue", "Check suitability", "Sign out"].sort());
  });

  it("takes the coordinator back to the venue", async () => {
    signInAs("EVENT_COORDINATOR");
    render(<App />);
    await screen.findByLabelText("Event");

    fireEvent.click(screen.getByRole("button", { name: "Back to venue" }));

    await waitFor(() => expect(window.location.hash).toBe(`#/venues/${VENUE_ID}`));
  });

  it.each(["EVENT_ORGANISER", "VENUE_STAFF", "TECH_SUPPORT_STAFF", "ATTENDEE"])("gives %s no route to it (K1-T12)", async (role) => {
    signInAs(role);
    render(<App />);

    await waitFor(() => expect(window.location.hash).not.toContain("suitability"));
    expect(screen.queryByLabelText("Event")).toBeNull();
    expect(getVenueSuitability).not.toHaveBeenCalled();
  });
});

describe("the venue page", () => {
  it("offers Event Coordinators the way to the suitability check, and nobody else", async () => {
    signInAs("EVENT_COORDINATOR", `/venues/${VENUE_ID}`);
    render(<App />);
    expect(await screen.findByRole("button", { name: "Check suitability" })).toBeTruthy();
    cleanup();

    signInAs("VENUE_STAFF", `/venues/${VENUE_ID}`);
    render(<App />);
    await screen.findByRole("button", { name: "Availability" });
    expect(screen.queryByRole("button", { name: "Check suitability" })).toBeNull();
  });
});
