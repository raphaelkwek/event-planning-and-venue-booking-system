import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { ApiError } from "../src/api/client.js";

/**
 * J1, J2 — the venue search screen: what is shown, what is sent to the server
 * when "Search" is clicked, the empty-result message, and the pre-fill from an
 * event. The server does the filtering (backend tests/venue); these tests
 * check the screen sends the right query and shows what comes back.
 */

const AUDITORIUM = {
  id: "v1",
  name: "Lee Kong Chian Auditorium",
  building: "School of Computing, Level 1",
  maxCapacity: 300,
  layoutCapacity: null,
  facilities: ["Projector", "Wireless microphones"],
  accessibilityFeatures: ["Hearing loop"],
};
const FILTERS = { q: null, from: null, to: null, minCapacity: null, location: null, layout: null, facilities: [], accessibility: [] };
const found = (items = [AUDITORIUM], filters = FILTERS, message: string | null = null) => ({
  items,
  filters,
  appliedFilters: [],
  message,
});

vi.mock("../src/api/venues.js", async () => {
  const actual = await vi.importActual<typeof import("../src/api/venues.js")>("../src/api/venues.js");
  return {
    ...actual,
    searchVenues: vi.fn(async () => found()),
    getSearchOptions: vi.fn(async () => ({
      layouts: ["Classroom", "Theatre"],
      facilities: ["Projector", "Stage lighting", "Wireless microphones"],
      accessibilityFeatures: ["Hearing loop", "Step-free access"],
    })),
    getSearchPrefill: vi.fn(async () => ({
      eventId: "e1",
      reference: "EVT-000101",
      filters: {
        from: "2026-12-14T04:00:00.000Z",
        to: "2026-12-14T06:00:00.000Z",
        minCapacity: 150,
        layout: "Theatre",
        facilities: ["Projector", "Wireless microphones"],
        accessibility: ["Hearing loop"],
      },
      unmatchedAccessibility: ["Reserved seating"],
    })),
  };
});

const { App } = await import("../src/App.js");
const { searchVenues, getSearchPrefill } = await import("../src/api/venues.js");

function signInAs(role: string, path = "/venues/search") {
  sessionStorage.setItem(
    "connectsphere.session",
    JSON.stringify({ userId: "user-id", email: "user@connectsphere.test", role, token: "token", lastLoginAt: "2026-10-10T01:00:00.000Z" }),
  );
  window.location.hash = `#${path}`;
}

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.mocked(searchVenues).mockClear();
  vi.mocked(getSearchPrefill).mockClear();
});

const lastForm = () => vi.mocked(searchVenues).mock.calls.at(-1)![1];
const field = (label: string) => screen.getByLabelText(label, { exact: true }) as HTMLInputElement;
const type = (label: string, value: string) => fireEvent.change(field(label), { target: { value } });
const search = () => fireEvent.click(screen.getByRole("button", { name: "Search" }));

async function openSearch(role = "EVENT_COORDINATOR", path = "/venues/search") {
  signInAs(role, path);
  render(<App />);
  await screen.findByRole("heading", { name: "Find a venue" });
}

describe("the venue search screen", () => {
  it("offers every filter, and the name-or-building search (J1 AC1, J2)", async () => {
    await openSearch();
    for (const label of ["Search by name or building", "Building / location", "Minimum capacity", "Layout", "From", "To"]) {
      expect(screen.getByLabelText(label, { exact: true }), label).toBeTruthy();
    }
    expect(screen.getByRole("group", { name: "Facilities" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Accessibility features" })).toBeTruthy();
    expect(await screen.findByLabelText("Stage lighting")).toBeTruthy();
    expect(screen.getByLabelText("Step-free access")).toBeTruthy();
  });

  it("lists every active venue on opening, with nothing chosen (J2 AC4)", async () => {
    await openSearch();
    expect(await screen.findByText("Lee Kong Chian Auditorium")).toBeTruthy();
    expect(lastForm()).toMatchObject({ q: "", from: "", to: "", minCapacity: "", location: "", layout: "", facilities: [], accessibility: [] });
  });

  it("shows each row's name, building, maximum capacity and facilities (J2 AC3)", async () => {
    await openSearch();
    const row = (await screen.findByText("Lee Kong Chian Auditorium")).closest("tr")!;
    const cells = within(row).getAllByRole("cell").map((cell) => cell.textContent);
    expect(cells.slice(0, 4)).toEqual(["Lee Kong Chian Auditorium", "School of Computing, Level 1", "300", "Projector, Wireless microphones"]);
    expect(within(row).getByRole("link", { name: "Availability" }).getAttribute("href")).toBe("#/venues/v1/availability");
  });

  it("sends the search term and every filter chosen when Search is clicked (J1 AC1, J2 AC2)", async () => {
    await openSearch();
    type("Search by name or building", "hall");
    type("Building / location", "Science");
    type("Minimum capacity", "150");
    type("Layout", "Theatre");
    type("From", "2026-12-14T12:00");
    type("To", "2026-12-14T14:00");
    fireEvent.click(await screen.findByLabelText("Projector"));
    fireEvent.click(screen.getByLabelText("Hearing loop"));
    search();

    await vi.waitFor(() =>
      expect(lastForm()).toEqual({
        q: "hall",
        location: "Science",
        minCapacity: "150",
        layout: "Theatre",
        from: "2026-12-14T12:00",
        to: "2026-12-14T14:00",
        facilities: ["Projector"],
        accessibility: ["Hearing loop"],
      }),
    );
  });

  it("stops asking for a facility that is unticked again", async () => {
    await openSearch();
    fireEvent.click(await screen.findByLabelText("Projector"));
    fireEvent.click(screen.getByLabelText("Stage lighting"));
    fireEvent.click(screen.getByLabelText("Projector"));
    search();
    await vi.waitFor(() => expect(lastForm().facilities).toEqual(["Stage lighting"]));
  });

  it("shows the layout's capacity when a layout was searched", async () => {
    vi.mocked(searchVenues).mockResolvedValueOnce(found([{ ...AUDITORIUM, layoutCapacity: 120 }], { ...FILTERS, layout: "Classroom" }));
    await openSearch();
    const row = (await screen.findByText("Lee Kong Chian Auditorium")).closest("tr")!;
    expect(screen.getByText("Capacity in Classroom")).toBeTruthy();
    expect(within(row).getAllByRole("cell")[3]!.textContent).toBe("120");
  });

  it("shows an empty result as a message restating the filters, not an error (J1 AC7)", async () => {
    vi.mocked(searchVenues).mockResolvedValueOnce(
      found([], { ...FILTERS, minCapacity: 500 }, "No active venue matches all of these filters: minimum capacity 500."),
    );
    await openSearch();
    expect(await screen.findByText("No active venue matches all of these filters: minimum capacity 500.")).toBeTruthy();
    expect(screen.getByText("No venues match")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByText(/HTTP/)).toBeNull();
  });

  it("shows a refused window next to the fields at fault, and keeps what was typed (J1-T23)", async () => {
    await openSearch();
    await screen.findByText("Lee Kong Chian Auditorium");
    vi.mocked(searchVenues).mockRejectedValueOnce(
      new ApiError(400, {
        code: "VALIDATION_FAILED",
        message: "The venues could not be searched. Check the highlighted fields.",
        fields: [{ field: "to", message: "Enter when the window ends, as well as when it starts." }],
        correlationId: null,
      }),
    );
    type("From", "2026-12-14T12:00");
    search();

    expect(await screen.findByText("Enter when the window ends, as well as when it starts.")).toBeTruthy();
    expect(screen.getByText("The venues could not be searched. Check the highlighted fields.")).toBeTruthy();
    expect(field("From").value).toBe("2026-12-14T12:00");
    expect(screen.queryByText("Lee Kong Chian Auditorium")).toBeNull();
  });

  it("shows any other refusal as the server's own message", async () => {
    vi.mocked(searchVenues).mockRejectedValueOnce(
      new ApiError(503, { code: "IDENTITY_UNAVAILABLE", message: "Your permissions could not be verified.", correlationId: null }),
    );
    await openSearch();
    expect(await screen.findByText("Your permissions could not be verified.")).toBeTruthy();
  });

  it("clears every filter and searches again", async () => {
    await openSearch();
    type("Search by name or building", "hall");
    type("Minimum capacity", "100");
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));

    expect(field("Search by name or building").value).toBe("");
    expect(field("Minimum capacity").value).toBe("");
    await vi.waitFor(() => expect(lastForm()).toMatchObject({ q: "", minCapacity: "" }));
  });

  it("shows the latest search's result when an earlier one finishes after it", async () => {
    let finishFirst: (value: ReturnType<typeof found>) => void = () => undefined;
    vi.mocked(searchVenues).mockImplementationOnce(() => new Promise((resolve) => (finishFirst = resolve)));
    await openSearch();
    vi.mocked(searchVenues).mockResolvedValueOnce(found([{ ...AUDITORIUM, name: "Newer result" }]));
    // Enter in a field submits even while the first search is still running.
    fireEvent.submit(screen.getByRole("form", { name: "Venue search" }));
    expect(await screen.findByText("Newer result")).toBeTruthy();

    finishFirst(found([{ ...AUDITORIUM, name: "Older result" }]));
    await Promise.resolve();

    expect(screen.queryByText("Older result")).toBeNull();
    expect(screen.getByText("Newer result")).toBeTruthy();
  });
});

describe("opened from an event (J1 AC8)", () => {
  it("fills the filters from the event's requirements, runs the search, and says what it could not match (J1-T21)", async () => {
    await openSearch("EVENT_COORDINATOR", "/venues/search?eventId=e1");

    await vi.waitFor(() => expect(field("Minimum capacity").value).toBe("150"));
    expect(getSearchPrefill).toHaveBeenCalledWith("token", "e1");
    expect(field("From").value).toBe("2026-12-14T12:00");
    expect(field("To").value).toBe("2026-12-14T14:00");
    expect(field("Layout").value).toBe("Theatre");
    expect((screen.getByLabelText("Projector") as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText("Wireless microphones") as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText("Hearing loop") as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText("Stage lighting") as HTMLInputElement).checked).toBe(false);
    expect(screen.getByText(/EVT-000101/)).toBeTruthy();
    expect(screen.getByText("Not matched to a catalogue feature")).toBeTruthy();
    expect(screen.getByText(/Reserved seating/)).toBeTruthy();
    await vi.waitFor(() =>
      expect(lastForm()).toMatchObject({ minCapacity: "150", layout: "Theatre", facilities: ["Projector", "Wireless microphones"] }),
    );
  });

  it("lets the coordinator change the pre-filled filters and search again (J1-T22)", async () => {
    await openSearch("EVENT_COORDINATOR", "/venues/search?eventId=e1");
    await vi.waitFor(() => expect(field("Minimum capacity").value).toBe("150"));

    type("Layout", "");
    type("Minimum capacity", "50");
    fireEvent.click(screen.getByLabelText("Wireless microphones"));
    search();

    await vi.waitFor(() =>
      expect(lastForm()).toMatchObject({ layout: "", minCapacity: "50", facilities: ["Projector"], accessibility: ["Hearing loop"] }),
    );
  });

  it("keeps a facility from the event that no venue records, ticked, so it is still asked for", async () => {
    vi.mocked(getSearchPrefill).mockResolvedValueOnce({
      eventId: "e1",
      reference: null,
      filters: { from: null, to: null, minCapacity: null, layout: null, facilities: ["Smoke machine"], accessibility: [] },
      unmatchedAccessibility: [],
    });
    await openSearch("EVENT_COORDINATOR", "/venues/search?eventId=e1");
    expect(((await screen.findByLabelText("Smoke machine")) as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText(/this event/)).toBeTruthy();
  });

  it("shows why the pre-fill failed, and still lists the venues", async () => {
    vi.mocked(getSearchPrefill).mockRejectedValueOnce(
      new ApiError(404, { code: "EVENT_NOT_FOUND", message: "No event with that id exists.", correlationId: null }),
    );
    await openSearch("EVENT_COORDINATOR", "/venues/search?eventId=nope");
    expect(await screen.findByText("No event with that id exists.")).toBeTruthy();
    expect(await screen.findByText("Lee Kong Chian Auditorium")).toBeTruthy();
  });
});

describe("who can reach the search (A2, J1-T24)", () => {
  it("offers a coordinator the navigation link", async () => {
    await openSearch();
    expect(screen.getByRole("link", { name: "Find a venue" }).getAttribute("href")).toBe("#/venues/search");
  });

  it.each(["EVENT_ORGANISER", "VENUE_STAFF", "TECH_SUPPORT_STAFF", "ATTENDEE"])("gives %s no link and no screen, and asks the server for nothing", async (role) => {
    signInAs(role);
    render(<App />);
    await screen.findByRole("button", { name: "Sign out" });
    expect(screen.queryByRole("link", { name: "Find a venue" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Find a venue" })).toBeNull();
    expect(searchVenues).not.toHaveBeenCalled();
  });
});
