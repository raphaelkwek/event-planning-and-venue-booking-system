import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { ApiError } from "../src/api/client.js";

/**
 * L1, L2 — the coordinator's venue requests for an event, the request form, and
 * the Venue Staff queue.
 */

const EVENT_ID = "event-1";
const ASSIGNED = "assigned-coordinator";
const VENUE_ID = "venue-1";
const SEMINAR_ID = "venue-2";

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

function bookingRequest(overrides: Record<string, unknown> = {}) {
  return {
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
    facilities: ["Projector"],
    accessibilityFeatures: ["Step-free access"],
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
    suitabilityStatus: "SUITABLE",
    suitabilityReasons: [],
    justification: null,
    ...overrides,
  };
}

const CAPACITY = {
  condition: "LAYOUT_CAPACITY",
  outcome: "FAILED",
  required: 150,
  available: 120,
  message: "Expected attendance 150 against layout capacity 120 (Classroom).",
};
const HOURS = {
  condition: "OPERATING_HOURS",
  outcome: "FAILED",
  required: "2026-12-02 14:00–23:00",
  available: "Wednesday 08:00–22:00",
  message: "The requested period 2026-12-02 14:00–23:00 is outside Wednesday's operating hours 08:00–22:00.",
};
const NOT_SUITABLE = "Lee Kong Chian Auditorium is not suitable for this request. Give a justification to request it anyway.";
const JUSTIFY = "Give a justification: at least one character that isn't a space.";
const justificationRequired = (reasons: unknown[]) =>
  new ApiError(422, {
    code: "JUSTIFICATION_REQUIRED",
    message: NOT_SUITABLE,
    details: { status: "NOT_SUITABLE", reasons },
    fields: [{ field: "justification", message: JUSTIFY }],
    correlationId: null,
  });

const open = (opensAt: string, closesAt: string) => ({ opensAt, closesAt });
function venue(id: string, name: string, layouts: { name: string; capacity: number }[], facilities: string[], accessibilityFeatures: string[]) {
  return {
    id,
    name,
    building: "School of Computing",
    maxCapacity: 300,
    layouts,
    facilities,
    accessibilityFeatures,
    operatingHours: { monday: open("08:00", "22:00") },
    isActive: true,
  };
}
const VENUES = {
  [VENUE_ID]: venue(VENUE_ID, "Lee Kong Chian Auditorium", [{ name: "Theatre", capacity: 300 }, { name: "Classroom", capacity: 120 }], ["Projector", "Wireless microphones"], ["Step-free access", "Hearing loop"]),
  [SEMINAR_ID]: venue(SEMINAR_ID, "Seminar Room 2-1", [{ name: "Classroom", capacity: 60 }], ["Whiteboard"], ["Step-free access"]),
};

type Fn = (...args: unknown[]) => Promise<unknown>;
const listEventBookingRequests = vi.fn<Parameters<Fn>, ReturnType<Fn>>(async () => ({ event: EVENT, items: [bookingRequest()] }));
const createBookingRequest = vi.fn<Parameters<Fn>, ReturnType<Fn>>(async () => bookingRequest({ reference: "BKR-000002" }));
const withdrawBookingRequest = vi.fn<Parameters<Fn>, ReturnType<Fn>>(async () => bookingRequest({ status: "WITHDRAWN" }));
const listBookingQueue = vi.fn<Parameters<Fn>, ReturnType<Fn>>(async () => ({
  items: [
    bookingRequest({
      endsAt: "2026-12-02T11:00:00.000Z",
      expectedAttendance: 180,
      differsFromEvent: true,
      differences: [
        { field: "endsAt", event: "2026-12-02T10:00:00.000Z", requested: "2026-12-02T11:00:00.000Z" },
        { field: "expectedAttendance", event: 150, requested: 180 },
      ],
    }),
  ],
}));

vi.mock("../src/api/bookingRequests.js", async () => {
  const actual = await vi.importActual<typeof import("../src/api/bookingRequests.js")>("../src/api/bookingRequests.js");
  return {
    ...actual,
    listEventBookingRequests: (...args: unknown[]) => listEventBookingRequests(...args),
    createBookingRequest: (...args: unknown[]) => createBookingRequest(...args),
    withdrawBookingRequest: (...args: unknown[]) => withdrawBookingRequest(...args),
    listBookingQueue: (...args: unknown[]) => listBookingQueue(...args),
  };
});

vi.mock("../src/api/venues.js", async () => {
  const actual = await vi.importActual<typeof import("../src/api/venues.js")>("../src/api/venues.js");
  return {
    ...actual,
    listVenues: vi.fn(async () => ({
      items: [
        { id: VENUE_ID, name: "Lee Kong Chian Auditorium", building: "SoC", maxCapacity: 300, isActive: true },
        { id: SEMINAR_ID, name: "Seminar Room 2-1", building: "SoC", maxCapacity: 60, isActive: true },
        { id: "venue-3", name: "Old Lecture Theatre", building: "SoE", maxCapacity: 200, isActive: false },
      ],
    })),
    getVenue: vi.fn(async (_token: string, id: string) => VENUES[id as keyof typeof VENUES]),
  };
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

describe("the event's venue requests (L1, L2)", () => {
  it("lists the event's requests with their details and status, and offers the assigned coordinator a new request (L1-T1)", async () => {
    signInAs(ASSIGNED, "EVENT_COORDINATOR", `/events/${EVENT_ID}/venue-requests`);
    render(<App />);

    const row = await screen.findByRole("row", { name: /BKR-000001/ });
    expect(rowText(row)).toContain("Lee Kong Chian Auditorium");
    expect(rowText(row)).toContain("Wednesday 2 December 2026, 14:00–18:00");
    expect(rowText(row)).toContain("Theatre");
    expect(rowText(row)).toContain("150");
    expect(rowText(row)).toMatch(/pending/i);
    expect(screen.getByRole("button", { name: "Request a venue" })).toBeTruthy();
    expect(within(row).getByRole("button", { name: "Withdraw" })).toBeTruthy();
  });

  it("marks a request that differs from the event (L1-T4)", async () => {
    listEventBookingRequests.mockResolvedValueOnce({ event: EVENT, items: [bookingRequest({ differsFromEvent: true })] });
    signInAs(ASSIGNED, "EVENT_COORDINATOR", `/events/${EVENT_ID}/venue-requests`);
    render(<App />);
    expect(rowText(await screen.findByRole("row", { name: /BKR-000001/ }))).toMatch(/differs from the event/i);
  });

  it("offers a coordinator who isn't assigned neither a new request nor a withdrawal (L1-T11, L2-T2)", async () => {
    signInAs("another-coordinator", "EVENT_COORDINATOR", `/events/${EVENT_ID}/venue-requests`);
    render(<App />);
    await screen.findByRole("row", { name: /BKR-000001/ });
    expect(screen.queryByRole("button", { name: "Request a venue" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Withdraw" })).toBeNull();
  });

  it("offers no withdrawal once a request isn't pending (L2-T3)", async () => {
    listEventBookingRequests.mockResolvedValueOnce({
      event: EVENT,
      items: [bookingRequest({ status: "APPROVED" }), bookingRequest({ id: "r2", reference: "BKR-000002", status: "WITHDRAWN" })],
    });
    signInAs(ASSIGNED, "EVENT_COORDINATOR", `/events/${EVENT_ID}/venue-requests`);
    render(<App />);
    await screen.findByRole("row", { name: /BKR-000002/ });
    expect(screen.queryByRole("button", { name: "Withdraw" })).toBeNull();
  });

  it("withdraws a request after confirming, naming it, and shows the new status (L2-T1)", async () => {
    signInAs(ASSIGNED, "EVENT_COORDINATOR", `/events/${EVENT_ID}/venue-requests`);
    render(<App />);
    fireEvent.click(within(await screen.findByRole("row", { name: /BKR-000001/ })).getByRole("button", { name: "Withdraw" }));

    const dialog = await screen.findByRole("dialog");
    expect(dialog.textContent).toContain("BKR-000001");
    listEventBookingRequests.mockResolvedValueOnce({ event: EVENT, items: [bookingRequest({ status: "WITHDRAWN" })] });
    fireEvent.click(within(dialog).getByRole("button", { name: "Withdraw request" }));

    await vi.waitFor(() => expect(withdrawBookingRequest).toHaveBeenCalledWith("token", "request-1"));
    await vi.waitFor(() => expect(rowText(screen.getByRole("row", { name: /BKR-000001/ }))).toMatch(/withdrawn/i));
    expect(screen.getByText("BKR-000001 withdrawn.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Withdraw" })).toBeNull();
  });
});

describe("the request form (L1)", () => {
  async function openForm() {
    signInAs(ASSIGNED, "EVENT_COORDINATOR", `/events/${EVENT_ID}/venue-requests/new`);
    render(<App />);
    await screen.findByRole("heading", { name: "Request a venue" });
  }
  const input = (label: string) => screen.getByLabelText(label) as HTMLInputElement | HTMLSelectElement;

  it("starts from the event's date, times and attendance, and lists only active venues (L1-T3)", async () => {
    await openForm();
    expect(input("Date").value).toBe("2026-12-02");
    expect(input("Start time").value).toBe("14:00");
    expect(input("End time").value).toBe("18:00");
    expect(input("Expected attendance").value).toBe("150");
    const options = within(input("Venue") as HTMLSelectElement).getAllByRole("option").map((o) => o.textContent);
    expect(options).toContain("Lee Kong Chian Auditorium");
    expect(options).not.toContain("Old Lecture Theatre");
  });

  it("offers the chosen venue's layouts, facilities and features, ticking the ones the event asks for (L1-T2)", async () => {
    await openForm();
    fireEvent.change(input("Venue"), { target: { value: VENUE_ID } });

    await vi.waitFor(() => expect(within(input("Room layout") as HTMLSelectElement).getAllByRole("option").map((o) => o.textContent)).toContain("Classroom"));
    expect(input("Room layout").value).toBe("Theatre");
    expect((screen.getByLabelText("Projector") as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText("Wireless microphones") as HTMLInputElement).checked).toBe(false);
    expect((screen.getByLabelText("Step-free access") as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText("Hearing loop") as HTMLInputElement).checked).toBe(false);
  });

  it("sends what was chosen, in Singapore time, then shows the new reference on the event's requests (L1-T1, L1-T2)", async () => {
    await openForm();
    fireEvent.change(input("Venue"), { target: { value: VENUE_ID } });
    await screen.findByLabelText("Hearing loop");
    fireEvent.change(input("Room layout"), { target: { value: "Classroom" } });
    fireEvent.click(screen.getByLabelText("Wireless microphones"));
    fireEvent.click(screen.getByLabelText("Hearing loop"));
    fireEvent.change(input("End time"), { target: { value: "19:00" } });
    fireEvent.change(input("Expected attendance"), { target: { value: "180" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit request" }));

    await screen.findByText("Booking request BKR-000002 submitted.");
    expect(createBookingRequest).toHaveBeenCalledWith("token", {
      eventId: EVENT_ID,
      venueId: VENUE_ID,
      startsAt: "2026-12-02T14:00:00+08:00",
      endsAt: "2026-12-02T19:00:00+08:00",
      layout: "Classroom",
      expectedAttendance: 180,
      facilities: ["Projector", "Wireless microphones"],
      accessibilityFeatures: ["Step-free access", "Hearing loop"],
    });
  });

  it("shows each refused field under its field, and keeps what was entered (L1-T12)", async () => {
    await openForm();
    fireEvent.change(input("Venue"), { target: { value: VENUE_ID } });
    await screen.findByLabelText("Hearing loop");
    createBookingRequest.mockRejectedValueOnce(
      new ApiError(400, {
        code: "VALIDATION_FAILED",
        message: "The request could not be submitted. Check the highlighted fields.",
        fields: [
          { field: "endsAt", message: "The end must be after the start." },
          { field: "expectedAttendance", message: "Expected attendance must be a whole number greater than zero." },
        ],
        correlationId: null,
      }),
    );
    fireEvent.change(input("End time"), { target: { value: "13:00" } });
    fireEvent.change(input("Expected attendance"), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit request" }));

    expect(await screen.findByText("The end must be after the start.")).toBeTruthy();
    expect(screen.getByText("Expected attendance must be a whole number greater than zero.")).toBeTruthy();
    expect(input("End time").value).toBe("13:00");
  });

  it("shows a refusal of the whole request, such as a duplicate (L1-T8)", async () => {
    await openForm();
    fireEvent.change(input("Venue"), { target: { value: VENUE_ID } });
    await screen.findByLabelText("Hearing loop");
    createBookingRequest.mockRejectedValueOnce(
      new ApiError(409, {
        code: "BOOKING_REQUEST_DUPLICATE",
        message: "This event already has a pending request for this venue that overlaps this period: BKR-000001.",
        correlationId: null,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Submit request" }));
    expect(await screen.findByText(/overlaps this period: BKR-000001/)).toBeTruthy();
  });
});

describe("justifying a venue that isn't suitable (K2)", () => {
  async function openFormWithVenue() {
    signInAs(ASSIGNED, "EVENT_COORDINATOR", `/events/${EVENT_ID}/venue-requests/new`);
    render(<App />);
    await screen.findByRole("heading", { name: "Request a venue" });
    fireEvent.change(screen.getByLabelText("Venue"), { target: { value: VENUE_ID } });
    await screen.findByLabelText("Hearing loop");
    fireEvent.change(screen.getByLabelText("Room layout"), { target: { value: "Classroom" } });
  }

  it("shows no justification box until the server finds the venue not suitable (K2-T1)", async () => {
    await openFormWithVenue();
    expect(screen.queryByLabelText("Justification")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Submit request" }));
    await screen.findByText("Booking request BKR-000002 submitted.");
    expect(createBookingRequest.mock.calls[0]![1]).not.toHaveProperty("justification");
  });

  it("lists every failing condition, asks for a justification, and stores nothing yet (K2-T2, K2-T7)", async () => {
    await openFormWithVenue();
    createBookingRequest.mockRejectedValueOnce(justificationRequired([CAPACITY, HOURS]));
    fireEvent.click(screen.getByRole("button", { name: "Submit request" }));

    const section = await screen.findByRole("region", { name: "Not suitable" });
    expect(section.textContent).toContain(NOT_SUITABLE);
    const items = within(section).getAllByRole("listitem").map((li) => li.textContent);
    expect(items).toEqual([CAPACITY.message, HOURS.message]);
    expect((screen.getByLabelText("Justification") as HTMLTextAreaElement).value).toBe("");
    expect(screen.getByText(JUSTIFY)).toBeTruthy();
    expect((screen.getByLabelText("Room layout") as HTMLSelectElement).value).toBe("Classroom");
    expect(screen.queryByText(/submitted\./)).toBeNull();
  });

  it("sends the justification with the request and shows the new reference (K2-T4)", async () => {
    await openFormWithVenue();
    createBookingRequest.mockRejectedValueOnce(justificationRequired([CAPACITY]));
    fireEvent.click(screen.getByRole("button", { name: "Submit request" }));
    fireEvent.change(await screen.findByLabelText("Justification"), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit request" }));

    await screen.findByText("Booking request BKR-000002 submitted.");
    expect(createBookingRequest).toHaveBeenLastCalledWith("token", expect.objectContaining({ layout: "Classroom", justification: "x" }));
  });

  it("drops the justification box when another venue is chosen", async () => {
    await openFormWithVenue();
    createBookingRequest.mockRejectedValueOnce(justificationRequired([CAPACITY]));
    fireEvent.click(screen.getByRole("button", { name: "Submit request" }));
    await screen.findByLabelText("Justification");

    fireEvent.change(screen.getByLabelText("Venue"), { target: { value: SEMINAR_ID } });
    await vi.waitFor(() => expect(screen.queryByLabelText("Justification")).toBeNull());
  });

  it("shows Venue Staff the suitability, the failing conditions and the justification (K2-T6)", async () => {
    listBookingQueue.mockResolvedValueOnce({
      items: [
        bookingRequest({
          layout: "Classroom",
          suitabilityStatus: "NOT_SUITABLE",
          suitabilityReasons: [CAPACITY],
          justification: "Only the auditorium has a stage; the extra 30 will stand at the back.",
        }),
        bookingRequest({ id: "r2", reference: "BKR-000002" }),
        bookingRequest({ id: "r3", reference: "BKR-000003", suitabilityStatus: null, suitabilityReasons: null }),
      ],
    });
    signInAs("venue-staff", "VENUE_STAFF", "/booking-requests");
    render(<App />);

    const unsuitable = rowText(await screen.findByRole("row", { name: /BKR-000001/ }));
    expect(unsuitable).toContain("Not suitable");
    expect(unsuitable).toContain(CAPACITY.message);
    expect(unsuitable).toContain("Justification: Only the auditorium has a stage; the extra 30 will stand at the back.");
    const suitable = rowText(screen.getByRole("row", { name: /BKR-000002/ }));
    expect(suitable).toContain("Suitable");
    expect(suitable).not.toContain("Justification");
    expect(rowText(screen.getByRole("row", { name: /BKR-000003/ }))).toContain("Not assessed");
  });
});

describe("the Venue Staff queue (L1)", () => {
  it("lists pending requests with every detail and what differs from the event (L1-T2, L1-T4, L1-T5)", async () => {
    signInAs("venue-staff", "VENUE_STAFF", "/booking-requests");
    render(<App />);

    const row = await screen.findByRole("row", { name: /BKR-000001/ });
    const text = rowText(row);
    for (const part of ["EVT-000123", "Lee Kong Chian Auditorium", "Wednesday 2 December 2026, 14:00–19:00", "Theatre", "180", "Projector", "Step-free access"]) {
      expect(text, part).toContain(part);
    }
    expect(text).toMatch(/differs from the event/i);
    expect(text).toContain("End 19:00 (event 18:00)");
    expect(text).toContain("Attendance 180 (event 150)");
    expect(text).not.toContain("Start ");
    expect(screen.getByRole("link", { name: "Booking requests" })).toBeTruthy();
  });
});

describe("who reaches what", () => {
  it("gives coordinators no Venue Staff queue in the navigation", async () => {
    signInAs(ASSIGNED, "EVENT_COORDINATOR", `/events/${EVENT_ID}/venue-requests`);
    render(<App />);
    await screen.findByRole("heading", { name: "Venue requests" });
    expect(screen.queryByRole("link", { name: "Booking requests" })).toBeNull();
  });

  it("gives attendees no route to booking requests, and requests nothing", async () => {
    for (const path of ["/booking-requests", `/events/${EVENT_ID}/venue-requests`]) {
      signInAs("someone", "ATTENDEE", path);
      render(<App />);
      await screen.findByRole("button", { name: "Sign out" });
      expect(screen.queryByRole("heading", { name: /requests/i })).toBeNull();
      cleanup();
    }
    expect(listBookingQueue).not.toHaveBeenCalled();
    expect(listEventBookingRequests).not.toHaveBeenCalled();
  });
});
