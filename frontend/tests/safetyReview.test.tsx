import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

/**
 * U1 — the Safety Officer's queue, the review with its decision form, and the assigned coordinator's
 * Mark Confirmed. Only the HTTP boundary is stubbed. The server is the real control (A2); these
 * check what each screen shows and sends.
 */
const EVENT_ID = "e1000000-0000-4000-8000-000000000011";
const OFFICER = "officer-id";
const COORDINATOR = "coordinator-id";

const queueEntry = {
  id: EVENT_ID,
  reference: "EVT-000011",
  name: "Annual Research Symposium",
  expectedAttendance: 120,
  proposedStartAt: "2026-12-02T06:00:00.000Z",
  proposedEndAt: "2026-12-02T10:00:00.000Z",
  assignedCoordinatorId: COORDINATOR,
  enteredSafetyReviewAt: "2026-11-02T01:00:00.000Z",
  decision: null,
};

const reviewBody = (overrides: Record<string, unknown> = {}) => ({
  event: {
    id: EVENT_ID,
    reference: "EVT-000011",
    name: "Annual Research Symposium",
    status: "SAFETY_REVIEW",
    assignedCoordinatorId: COORDINATOR,
    proposedStartAt: "2026-12-02T06:00:00.000Z",
    proposedEndAt: "2026-12-02T10:00:00.000Z",
  },
  factors: {
    expectedAttendance: 120,
    accessibilityNeeds: "Step-free access to the main hall",
    venues: [
      {
        bookingId: "b1000000-0000-4000-8000-000000000001",
        reference: "BKR-000001",
        status: "CONFIRMED",
        venueName: "Lee Kong Chian Auditorium",
        startsAt: "2026-12-02T06:00:00.000Z",
        endsAt: "2026-12-02T10:00:00.000Z",
        layout: "Theatre",
        layoutCapacity: 150,
        venueMaxCapacity: 200,
        layouts: [
          { name: "Theatre", capacity: 150 },
          { name: "Banquet", capacity: 80 },
        ],
      },
    ],
    equipment: [
      {
        lineId: "l1000000-0000-4000-8000-000000000001",
        equipmentTypeName: "Folding Chairs",
        quantity: 5,
        reservationId: "r1000000-0000-4000-8000-000000000001",
        reservedQuantity: 5,
        placementNotes: "Rows along the north wall",
      },
    ],
  },
  flags: [],
  decision: null,
  ...overrides,
});

const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
let review: ReturnType<typeof reviewBody>;
let onDecision: (body: Record<string, unknown>) => Response;
let onMarkConfirmed: () => Response;
const fetchMock = vi.fn(async (path: string, init?: RequestInit) => {
  const url = new URL(path, "http://app.test");
  if (url.pathname === "/event/api/v1/safety-reviews") return reply({ events: [queueEntry] });
  if (url.pathname === `/event/api/v1/events/${EVENT_ID}/safety-review`) return reply(review);
  if (url.pathname === `/event/api/v1/events/${EVENT_ID}/safety-decision`) return onDecision(JSON.parse(String(init?.body)));
  if (url.pathname === `/event/api/v1/events/${EVENT_ID}/mark-confirmed`) return onMarkConfirmed();
  if (url.pathname.includes("/notifications")) return reply({ items: [], unreadCount: 0, nextCursor: null });
  return reply({ items: [] });
});
const decisions = () => fetchMock.mock.calls.filter(([path]) => String(path).endsWith("/safety-decision"));

// The coordinator's event page loads the event itself.
function eventBody(status: string) {
  return {
    id: EVENT_ID, reference: "EVT-000011", ownerId: "organiser-id", name: "Annual Research Symposium",
    purpose: "Share faculty research", description: "A one-day symposium.",
    proposedStartAt: "2026-12-02T06:00:00.000Z", proposedEndAt: "2026-12-02T10:00:00.000Z",
    expectedAttendance: 120, venueRequirements: null, accessibilityNeeds: null,
    equipmentRequired: true, equipmentRequirements: null, registrationRequired: false,
    registrationOpensAt: null, registrationClosesAt: null, status,
    submittedAt: "2026-09-17T01:00:00.000Z", lastSavedAt: "2026-09-17T01:00:00.000Z",
    reviewingCoordinatorId: COORDINATOR, reviewStartedAt: null, decidedBy: COORDINATOR,
    decidedAt: "2026-09-18T01:00:00.000Z", rejectionReason: null, assignedCoordinatorId: COORDINATOR,
    contactDetails: null, version: 1,
  };
}
let current: ReturnType<typeof eventBody>;
vi.mock("../src/api/events.js", async () => {
  const actual = await vi.importActual<typeof import("../src/api/events.js")>("../src/api/events.js");
  return {
    ...actual,
    openEvent: async () => current,
    listClarifications: async () => ({ items: [], nextCursor: null }),
    listReassignmentProposals: async () => ({ items: [], nextCursor: null }),
  };
});
vi.mock("../src/api/users.js", () => ({ lookupUsers: vi.fn(async () => []) }));
const { App } = await import("../src/App.js");

function signIn(role: string, userId: string, hash: string) {
  sessionStorage.setItem(
    "connectsphere.session",
    JSON.stringify({ userId, email: "u@connectsphere.test", role, token: "t", lastLoginAt: "2026-11-02T00:00:00.000Z" }),
  );
  window.location.hash = hash;
  render(<App />);
}

beforeEach(() => {
  review = reviewBody();
  current = eventBody("SAFETY_REVIEW");
  onDecision = () => reply({ decision: { id: "d1" }, event: { id: EVENT_ID, status: "SAFETY_REVIEW", previousStatus: "SAFETY_REVIEW" } }, 201);
  onMarkConfirmed = () => reply({ event: { id: EVENT_ID, status: "CONFIRMED", previousStatus: "SAFETY_REVIEW", confirmedAt: "2026-11-02T02:00:00.000Z" } });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  sessionStorage.clear();
  fetchMock.mockClear();
  vi.unstubAllGlobals();
});

describe("the Safety Officer's navigation and queue (U1)", () => {
  it("lands the Safety Officer on the queue, which lists the events and links to each review", async () => {
    signIn("SAFETY_OFFICER", OFFICER, "#/");
    expect(await screen.findByRole("heading", { name: "Safety queue" })).toBeTruthy();
    const table = await screen.findByRole("table", { name: "Events in Safety Review" });
    expect(within(table).getByText("Annual Research Symposium")).toBeTruthy();
    expect(within(table).getByText("Awaiting your decision")).toBeTruthy();
    expect(within(table).getByRole("link", { name: "EVT-000011" }).getAttribute("href")).toBe(`#/safety/${EVENT_ID}`);
    expect(screen.getByRole("link", { name: "Safety queue" })).toBeTruthy();
  });

  it("shows an approved event as awaiting Mark Confirmed", async () => {
    fetchMock.mockImplementationOnce(async () => reply({ events: [{ ...queueEntry, decision: "APPROVE" }] }));
    signIn("SAFETY_OFFICER", OFFICER, "#/safety");
    expect(await screen.findByText("Approved, awaiting Mark Confirmed")).toBeTruthy();
  });

  it("does not offer the Safety queue to a coordinator, and sends them to their own landing screen", async () => {
    signIn("EVENT_COORDINATOR", COORDINATOR, "#/safety");
    await waitFor(() => expect(window.location.hash).toBe("#/queue"));
    expect(screen.queryByRole("link", { name: "Safety queue" })).toBeNull();
  });
});

describe("the review (U1 AC2)", () => {
  it("shows attendance, accessibility, each venue's capacity and layout, and the equipment with its placement notes", async () => {
    signIn("SAFETY_OFFICER", OFFICER, `#/safety/${EVENT_ID}`);
    const factors = await screen.findByLabelText("Safety factors");
    expect(within(factors).getByText("120")).toBeTruthy();
    expect(within(factors).getByText("Step-free access to the main hall")).toBeTruthy();
    const venues = await screen.findByRole("table", { name: "Booked venues" });
    expect(within(venues).getByText("Lee Kong Chian Auditorium")).toBeTruthy();
    expect(within(venues).getByText("Theatre")).toBeTruthy();
    expect(within(venues).getByText("150")).toBeTruthy();
    expect(within(venues).getByText("Theatre (150), Banquet (80)")).toBeTruthy();
    const equipment = await screen.findByRole("table", { name: "Equipment and placement" });
    expect(within(equipment).getByText("Rows along the north wall")).toBeTruthy();
  });

  it("warns when arrangement flags are outstanding", async () => {
    review = reviewBody({ flags: [{ what: "equipment", name: "Folding Chairs", flag: "FLAGGED_FOR_REVIEW" }] });
    signIn("SAFETY_OFFICER", OFFICER, `#/safety/${EVENT_ID}`);
    expect(await screen.findByText("Arrangement flags are outstanding")).toBeTruthy();
    expect(screen.getByText(/equipment Folding Chairs: flagged for review/)).toBeTruthy();
  });

  it("shows the server's refusal when the event is not in Safety Review", async () => {
    fetchMock.mockImplementationOnce(async () =>
      reply({ error: { code: "STATUS_TRANSITION_NOT_PERMITTED", message: "This event is Confirmed, not Safety Review.", correlationId: null } }, 409),
    );
    signIn("SAFETY_OFFICER", OFFICER, `#/safety/${EVENT_ID}`);
    expect(await screen.findByText("This event is Confirmed, not Safety Review.")).toBeTruthy();
  });
});

describe("the decision form (U1 AC3 to AC6)", () => {
  async function open() {
    signIn("SAFETY_OFFICER", OFFICER, `#/safety/${EVENT_ID}`);
    return await screen.findByRole("form", { name: "Safety decision" });
  }
  const choose = (form: HTMLElement, name: RegExp) => fireEvent.click(within(form).getByRole("radio", { name }));

  it("sends an approval with no reason", async () => {
    const form = await open();
    fireEvent.click(within(form).getByRole("button", { name: "Record decision" }));
    await waitFor(() => expect(decisions()).toHaveLength(1));
    expect(JSON.parse(String(decisions()[0]![1]!.body))).toEqual({ decision: "APPROVE", reason: "" });
  });

  it("shows the server's message on the reason field when a reason is missing", async () => {
    onDecision = () =>
      reply(
        {
          error: {
            code: "VALIDATION_FAILED",
            message: "The decision could not be recorded. Check the highlighted fields.",
            fields: [{ field: "reason", message: "Give a reason when you request changes or reject the safety arrangement." }],
            correlationId: null,
          },
        },
        400,
      );
    const form = await open();
    choose(form, /Request changes/);
    fireEvent.click(within(form).getByRole("button", { name: "Record decision" }));
    expect((await screen.findAllByText("Give a reason when you request changes or reject the safety arrangement.")).length).toBeGreaterThan(0);
  });

  it("sends a request for changes with the reason and the arrangements ticked", async () => {
    const form = await open();
    choose(form, /Request changes/);
    fireEvent.click(within(form).getByLabelText("BKR-000001 at Lee Kong Chian Auditorium"));
    fireEvent.click(within(form).getByLabelText("Folding Chairs × 5"));
    fireEvent.change(within(form).getByLabelText(/Reason/), { target: { value: "Move the chairs away from the east exit" } });
    fireEvent.click(within(form).getByRole("button", { name: "Record decision" }));
    await waitFor(() => expect(decisions()).toHaveLength(1));
    expect(JSON.parse(String(decisions()[0]![1]!.body))).toEqual({
      decision: "REQUEST_CHANGES",
      reason: "Move the chairs away from the east exit",
      flagBookingIds: ["b1000000-0000-4000-8000-000000000001"],
      flagReservationIds: ["r1000000-0000-4000-8000-000000000001"],
    });
  });

  it("sends a rejection naming no arrangements", async () => {
    const form = await open();
    choose(form, /Reject/);
    fireEvent.change(within(form).getByLabelText(/Reason/), { target: { value: "Unsafe crowd flow" } });
    fireEvent.click(within(form).getByRole("button", { name: "Record decision" }));
    await waitFor(() => expect(decisions()).toHaveLength(1));
    expect(JSON.parse(String(decisions()[0]![1]!.body))).toEqual({ decision: "REJECT", reason: "Unsafe crowd flow" });
  });

  it("replaces the form with the recorded decision once there is one", async () => {
    review = reviewBody({
      decision: { id: "d1", decision: "APPROVE", reason: "Exits checked", flagged: { bookings: [], reservations: [] }, decidedBy: OFFICER, decidedAt: "2026-11-02T02:00:00.000Z" },
    });
    signIn("SAFETY_OFFICER", OFFICER, `#/safety/${EVENT_ID}`);
    expect(await screen.findByText("A decision is recorded for this review")).toBeTruthy();
    expect(screen.queryByRole("form", { name: "Safety decision" })).toBeNull();
  });
});

describe("Mark Confirmed on the coordinator's event page (U1 AC4)", () => {
  const markButton = () => screen.queryByRole("button", { name: "Mark Confirmed" });

  it("is offered to the assigned coordinator on an event in Safety Review, and moves it to Confirmed", async () => {
    signIn("EVENT_COORDINATOR", COORDINATOR, `#/review/${EVENT_ID}`);
    fireEvent.click(await screen.findByRole("button", { name: "Mark Confirmed" }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([path]) => String(path).endsWith("/mark-confirmed"))).toBe(true));
  });

  it("shows the server's refusal beside the button when the check has not been passed", async () => {
    onMarkConfirmed = () =>
      reply({ error: { code: "SAFETY_CHECK_NOT_PASSED", message: "The Safety Officer has not approved this event's safety arrangements, so it cannot be marked Confirmed.", correlationId: null } }, 409);
    signIn("EVENT_COORDINATOR", COORDINATOR, `#/review/${EVENT_ID}`);
    fireEvent.click(await screen.findByRole("button", { name: "Mark Confirmed" }));
    expect(await screen.findByText(/has not approved this event's safety arrangements/)).toBeTruthy();
  });

  it("is not offered to another coordinator, or on an event in another status", async () => {
    signIn("EVENT_COORDINATOR", "someone-else", `#/review/${EVENT_ID}`);
    await screen.findByText("Annual Research Symposium");
    expect(markButton()).toBeNull();
    cleanup();
    current = eventBody("PLANNING");
    signIn("EVENT_COORDINATOR", COORDINATOR, `#/review/${EVENT_ID}`);
    await screen.findByText("Annual Research Symposium");
    expect(markButton()).toBeNull();
  });
});
