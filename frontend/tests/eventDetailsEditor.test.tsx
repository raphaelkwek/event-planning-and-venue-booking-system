import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { ApiError } from "../src/api/client.js";

/**
 * G1 — editing an event's descriptive details: who is offered "Edit details",
 * what the edit screen lets them change, and what it shows when a save is
 * refused.
 */

const EVENT_ID = "event-1";
const OWNER = "organiser-id";
const ASSIGNED = "assigned-coordinator-id";

function event(overrides: Record<string, unknown> = {}) {
  return {
    id: EVENT_ID,
    reference: "EVT-000001",
    ownerId: OWNER,
    name: "Annual Research Symposium",
    purpose: "Share faculty research",
    description: "A one-day symposium.",
    proposedStartAt: "2026-12-02T06:00:00.000Z",
    proposedEndAt: "2026-12-02T10:00:00.000Z",
    expectedAttendance: 150,
    venueRequirements: { layout: "Theatre", facilities: ["Projector"], notes: null },
    accessibilityNeeds: "Step-free access to the stage",
    equipmentRequired: false,
    equipmentRequirements: null,
    registrationRequired: false,
    registrationOpensAt: null,
    registrationClosesAt: null,
    status: "APPROVED",
    submittedAt: "2026-09-17T01:00:00.000Z",
    lastSavedAt: "2026-09-17T01:00:00.000Z",
    reviewingCoordinatorId: ASSIGNED,
    reviewStartedAt: "2026-09-17T01:05:00.000Z",
    decidedBy: ASSIGNED,
    decidedAt: "2026-09-18T01:00:00.000Z",
    rejectionReason: null,
    assignedCoordinatorId: ASSIGNED,
    contactDetails: null,
    version: 3,
    ...overrides,
  };
}

type Event = ReturnType<typeof event>;
const openEvent = vi.fn<unknown[], Promise<Event>>(async () => event());
const updateEventDetails = vi.fn<unknown[], Promise<Event>>(async () => event({ purpose: "New purpose", version: 4 }));

vi.mock("../src/api/events.js", async () => {
  const actual = await vi.importActual<typeof import("../src/api/events.js")>("../src/api/events.js");
  return {
    ...actual,
    openEvent: (...args: unknown[]) => openEvent(...args),
    updateEventDetails: (...args: unknown[]) => updateEventDetails(...args),
    listClarifications: vi.fn(async () => ({ items: [], nextCursor: null })),
    listReassignmentProposals: vi.fn(async () => ({ items: [], nextCursor: null })),
  };
});

vi.mock("../src/api/users.js", () => ({ lookupUsers: vi.fn(async () => []) }));

const { App } = await import("../src/App.js");

function signInAs(userId: string, role: string, path: string) {
  sessionStorage.setItem(
    "connectsphere.session",
    JSON.stringify({ userId, email: "user@connectsphere.test", role, token: "token", lastLoginAt: "2026-10-11T01:00:00.000Z" }),
  );
  window.location.hash = `#${path}`;
}

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.clearAllMocks();
  openEvent.mockImplementation(async () => event());
});

async function openEditor(userId = OWNER, role = "EVENT_ORGANISER") {
  signInAs(userId, role, `/events/${EVENT_ID}/details`);
  render(<App />);
  await screen.findByRole("heading", { name: "Edit event details" });
}

const field = (label: string) => screen.getByLabelText(label) as HTMLInputElement | HTMLTextAreaElement;

describe("\"Edit details\" on the request pages", () => {
  it("is offered to the owner of an Approved request, and the page shows its contact details (G1-T1)", async () => {
    openEvent.mockImplementation(async () => event({ contactDetails: "Dr Tan, tan@smu.edu.sg" }));
    signInAs(OWNER, "EVENT_ORGANISER", `/requests/${EVENT_ID}`);
    render(<App />);
    expect(await screen.findByRole("button", { name: "Edit details" })).toBeTruthy();
    expect(screen.getByText("Dr Tan, tan@smu.edu.sg")).toBeTruthy();
  });

  it("is offered in Planning, Safety Review and Confirmed, and not before approval or once completed (G1-T3, G1-T4)", async () => {
    for (const [status, offered] of [
      ["PLANNING", true],
      ["SAFETY_REVIEW", true],
      ["CONFIRMED", true],
      ["UNDER_REVIEW", false],
      ["COMPLETED", false],
    ] as const) {
      openEvent.mockImplementation(async () => event({ status }));
      signInAs(OWNER, "EVENT_ORGANISER", `/requests/${EVENT_ID}`);
      render(<App />);
      await screen.findByRole("heading", { name: "Annual Research Symposium" });
      expect(screen.queryByRole("button", { name: "Edit details" }) !== null, status).toBe(offered);
      cleanup();
    }
  });

  it("is offered to the assigned coordinator and not to another coordinator (G1-T2, G1-T8)", async () => {
    signInAs(ASSIGNED, "EVENT_COORDINATOR", `/review/${EVENT_ID}`);
    render(<App />);
    expect(await screen.findByRole("button", { name: "Edit details" })).toBeTruthy();
    cleanup();

    signInAs("another-coordinator", "EVENT_COORDINATOR", `/review/${EVENT_ID}`);
    render(<App />);
    await screen.findByRole("heading", { name: "Annual Research Symposium" });
    expect(screen.queryByRole("button", { name: "Edit details" })).toBeNull();
  });
});

describe("the edit screen", () => {
  it("lets only the four descriptive fields be typed into, and shows the significant ones as text under the change-request note (G1-T5)", async () => {
    await openEditor();

    expect(field("Purpose").value).toBe("Share faculty research");
    expect(field("Description").value).toBe("A one-day symposium.");
    expect(field("Accessibility notes").value).toBe("Step-free access to the stage");
    expect(field("Contact details").value).toBe("");
    expect(screen.getAllByRole("textbox")).toHaveLength(4);

    const locked = screen.getByRole("region", { name: "Changed only through a change request" });
    expect(locked.textContent).toMatch(/change request/);
    expect(locked.textContent).toContain("150");
    expect(locked.textContent).toContain("Theatre");
    expect(within(locked).queryByRole("textbox")).toBeNull();
  });

  it("sends only the changed fields with the version it loaded, then shows the saved details on the request page (G1-T1)", async () => {
    await openEditor();
    openEvent.mockImplementation(async () => event({ purpose: "New purpose", version: 4 }));

    fireEvent.change(field("Purpose"), { target: { value: "New purpose" } });
    fireEvent.change(field("Contact details"), { target: { value: " Dr Tan " } });
    fireEvent.click(screen.getByRole("button", { name: "Save details" }));

    await screen.findByText("Details saved.");
    expect(updateEventDetails).toHaveBeenCalledWith("token", EVENT_ID, 3, { purpose: "New purpose", contactDetails: "Dr Tan" });
    expect(screen.getByRole("heading", { name: "Annual Research Symposium" })).toBeTruthy();
    expect(screen.getByText("New purpose")).toBeTruthy();
  });

  it("sends an emptied optional field as null", async () => {
    await openEditor();
    fireEvent.change(field("Accessibility notes"), { target: { value: "  " } });
    fireEvent.click(screen.getByRole("button", { name: "Save details" }));
    await screen.findByText("Details saved.");
    expect(updateEventDetails).toHaveBeenCalledWith("token", EVENT_ID, 3, { accessibilityNeeds: null });
  });

  it("saves nothing when nothing changed (G1-T12)", async () => {
    await openEditor();
    fireEvent.click(screen.getByRole("button", { name: "Save details" }));
    expect(await screen.findByText("No changes to save.")).toBeTruthy();
    expect(updateEventDetails).not.toHaveBeenCalled();
  });

  it("shows a refused field under that field and keeps what was typed (G1-T10)", async () => {
    await openEditor();
    updateEventDetails.mockRejectedValueOnce(
      new ApiError(400, {
        code: "VALIDATION_FAILED",
        message: "The details could not be saved.",
        fields: [{ field: "purpose", message: "Purpose is required." }],
        correlationId: null,
      }),
    );
    fireEvent.change(field("Purpose"), { target: { value: "   " } });
    fireEvent.change(field("Description"), { target: { value: "A new description" } });
    fireEvent.click(screen.getByRole("button", { name: "Save details" }));

    expect(await screen.findByText("Purpose is required.")).toBeTruthy();
    expect(field("Description").value).toBe("A new description");
  });

  it("says the event changed since it was opened, and Reload loads the latest (G1-T11)", async () => {
    await openEditor();
    updateEventDetails.mockRejectedValueOnce(
      new ApiError(412, {
        code: "EVENT_VERSION_MISMATCH",
        message: "This event was changed after you opened it, so nothing was saved. Load the latest version, then make your edit again.",
        correlationId: null,
      }),
    );
    fireEvent.change(field("Description"), { target: { value: "Edited by the coordinator" } });
    fireEvent.click(screen.getByRole("button", { name: "Save details" }));

    expect(await screen.findByText(/so nothing was saved/)).toBeTruthy();
    openEvent.mockImplementation(async () => event({ description: "Edited by the organiser", version: 4 }));
    fireEvent.click(screen.getByRole("button", { name: "Reload" }));

    await vi.waitFor(() => expect(field("Description").value).toBe("Edited by the organiser"));
    expect(screen.queryByText(/so nothing was saved/)).toBeNull();
  });

  it("is not opened for roles that never edit events, and nothing is requested", async () => {
    for (const role of ["VENUE_STAFF", "ATTENDEE"]) {
      signInAs("someone", role, `/events/${EVENT_ID}/details`);
      render(<App />);
      await screen.findByRole("button", { name: "Sign out" });
      expect(screen.queryByRole("heading", { name: "Edit event details" })).toBeNull();
      cleanup();
    }
    expect(openEvent).not.toHaveBeenCalled();
  });
});
