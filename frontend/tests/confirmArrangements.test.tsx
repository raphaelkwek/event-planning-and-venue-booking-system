import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

/** F5 — "Confirm arrangements" on the coordinator's event page. Only the HTTP boundary is stubbed. */
const EVENT_ID = "e1000000-0000-4000-8000-000000000005";
const OWNER = "organiser-id";
const COORDINATOR = "coordinator-id";

function event(overrides: Record<string, unknown> = {}) {
  return {
    id: EVENT_ID, reference: "EVT-000005", ownerId: OWNER, name: "Annual Research Symposium",
    purpose: "Share faculty research", description: "A one-day symposium.",
    proposedStartAt: "2026-12-02T06:00:00.000Z", proposedEndAt: "2026-12-02T10:00:00.000Z",
    expectedAttendance: 150, venueRequirements: null, accessibilityNeeds: null,
    equipmentRequired: true, equipmentRequirements: null, registrationRequired: false,
    registrationOpensAt: null, registrationClosesAt: null, status: "APPROVED",
    submittedAt: "2026-09-17T01:00:00.000Z", lastSavedAt: "2026-09-17T01:00:00.000Z",
    reviewingCoordinatorId: COORDINATOR, reviewStartedAt: null, decidedBy: COORDINATOR,
    decidedAt: "2026-09-18T01:00:00.000Z", rejectionReason: null, assignedCoordinatorId: COORDINATOR,
    contactDetails: null, version: 1, ...overrides,
  };
}

let current: ReturnType<typeof event>;
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

const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
let onConfirm: () => Response;
const fetchMock = vi.fn(async (path: string) => {
  const url = new URL(path, "http://app.test");
  if (url.pathname === `/event/api/v1/events/${EVENT_ID}/confirmation`) return onConfirm();
  if (url.pathname.includes("/notifications")) return reply({ items: [], unreadCount: 0, nextCursor: null });
  return reply({ items: [] });
});
const confirmations = () => fetchMock.mock.calls.filter(([path]) => String(path).endsWith("/confirmation"));

function asCoordinator(id = COORDINATOR) {
  sessionStorage.setItem(
    "connectsphere.session",
    JSON.stringify({ userId: id, email: "c@connectsphere.test", role: "EVENT_COORDINATOR", token: "t", lastLoginAt: "2026-10-20T00:00:00.000Z" }),
  );
  window.location.hash = `#/review/${EVENT_ID}`;
  render(<App />);
}
const confirmButton = () => screen.queryByRole("button", { name: "Confirm arrangements" });

const notReady = {
  error: {
    code: "ARRANGEMENTS_NOT_READY",
    message:
      "This event can't be confirmed yet. Venue: hold HLD-1 at F5 Hall is only a tentative hold. Equipment: F5 Chairs × 5 has 4 of 5 reserved. " +
      "Outstanding flags: booking BKR-000001 at F5 Hall requires reconfirmation.",
    details: {
      venue: [{ kind: "HOLD", reference: "HLD-1", venueName: "F5 Hall" }],
      equipment: [
        { kind: "LINE", lineId: "l1", equipmentTypeName: "F5 Chairs", quantity: 5, status: "RESERVED", requestedQuantity: 5, reservedQuantity: 4 },
        { kind: "LINE", lineId: "l2", equipmentTypeName: "Projectors", quantity: 2, status: "SUBMITTED", requestedQuantity: null, reservedQuantity: null },
      ],
      flags: [{ arrangement: "BOOKING", reference: "BKR-000001", name: "F5 Hall", flag: "REQUIRES_RECONFIRMATION" }],
    },
    correlationId: "corr-1",
  },
};

beforeEach(() => {
  current = event();
  onConfirm = () => {
    current = event({ status: "SAFETY_REVIEW" });
    return reply({ event: { id: EVENT_ID, reference: "EVT-000005", status: "SAFETY_REVIEW", previousStatus: "APPROVED", confirmedBy: COORDINATOR, confirmedAt: "2026-10-20T02:00:00.000Z" } });
  };
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  sessionStorage.clear();
  fetchMock.mockClear();
  vi.unstubAllGlobals();
});

describe("who sees Confirm arrangements (F5 AC1)", () => {
  it("the assigned coordinator, on an Approved event", async () => {
    asCoordinator();
    expect(await screen.findByRole("button", { name: "Confirm arrangements" })).toBeTruthy();
  });

  it("the assigned coordinator, on a Planning event", async () => {
    current = event({ status: "PLANNING" });
    asCoordinator();
    expect(await screen.findByRole("button", { name: "Confirm arrangements" })).toBeTruthy();
  });

  it("not another coordinator", async () => {
    asCoordinator("someone-else");
    await screen.findByText("Annual Research Symposium");
    expect(confirmButton()).toBeNull();
  });

  it("not on an event already in Safety Review, or one still under review", async () => {
    for (const status of ["SAFETY_REVIEW", "UNDER_REVIEW"]) {
      current = event({ status });
      asCoordinator();
      await screen.findByText("Annual Research Symposium");
      expect(confirmButton()).toBeNull();
      cleanup();
    }
  });
});

describe("confirming", () => {
  it("restates what happens before anything is sent, and Cancel sends nothing", async () => {
    asCoordinator();
    fireEvent.click(await screen.findByRole("button", { name: "Confirm arrangements" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/moves to Safety Review/)).toBeTruthy();
    expect(confirmations()).toHaveLength(0);
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(confirmations()).toHaveLength(0);
  });

  it("on success closes the dialog and shows Safety Review, with no further Confirm (F5 AC8)", async () => {
    asCoordinator();
    fireEvent.click(await screen.findByRole("button", { name: "Confirm arrangements" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirm arrangements" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(confirmations()).toHaveLength(1);
    expect(await screen.findAllByText("Safety Review")).not.toHaveLength(0);
    expect(confirmButton()).toBeNull();
  });

  it("shows a refusal inline in the dialog, naming each outstanding venue item, equipment line and flag (F5 AC6, AC7)", async () => {
    onConfirm = () => reply(notReady, 422);
    asCoordinator();
    fireEvent.click(await screen.findByRole("button", { name: "Confirm arrangements" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirm arrangements" }));

    expect(await within(dialog).findByText(notReady.error.message)).toBeTruthy();
    const listed = within(dialog).getByLabelText("Outstanding arrangements");
    expect(within(listed).getByText("HLD-1 at F5 Hall is only a tentative hold.")).toBeTruthy();
    expect(within(listed).getByText("F5 Chairs × 5: 4 of 5 reserved.")).toBeTruthy();
    expect(within(listed).getByText("Projectors × 2 is Submitted.")).toBeTruthy();
    expect(within(listed).getByText("BKR-000001 at F5 Hall: requires reconfirmation.")).toBeTruthy();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("shows the server's message when the arrangements could not be read (F5 AC5)", async () => {
    const message = "The venue and equipment arrangements could not be checked, so the event was not confirmed. Nothing was changed. Try again.";
    onConfirm = () => reply({ error: { code: "ARRANGEMENTS_UNAVAILABLE", message, correlationId: "corr-2" } }, 503);
    asCoordinator();
    fireEvent.click(await screen.findByRole("button", { name: "Confirm arrangements" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirm arrangements" }));
    expect(await within(dialog).findByText(message)).toBeTruthy();
    expect(within(dialog).queryByLabelText("Outstanding arrangements")).toBeNull();
  });
});
