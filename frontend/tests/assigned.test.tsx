import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

/**
 * A3 — the events assigned to a coordinator are marked as theirs. A4 (CR-05) —
 * the All events screen lists only what the server returns, which for a
 * coordinator is the events assigned to them, so it offers no filter.
 */

const ME = "00000000-0000-0000-0000-000000000002";
const OTHER = "00000000-0000-0000-0000-000000000008";

function record(id: string, name: string, assignedCoordinatorId: string | null, status = "SUBMITTED") {
  return {
    id,
    reference: `EVT-${id}`,
    ownerId: "00000000-0000-0000-0000-000000000001",
    name,
    purpose: "p",
    description: "d",
    proposedStartAt: "2026-12-02T06:00:00.000Z",
    proposedEndAt: "2026-12-02T10:00:00.000Z",
    expectedAttendance: 10,
    venueRequirements: null,
    accessibilityNeeds: null,
    equipmentRequired: false,
    equipmentRequirements: null,
    registrationRequired: false,
    registrationOpensAt: null,
    registrationClosesAt: null,
    status,
    submittedAt: "2026-09-17T01:00:00.000Z",
    lastSavedAt: "2026-09-17T01:00:00.000Z",
    reviewingCoordinatorId: null,
    reviewStartedAt: null,
    decidedBy: null,
    decidedAt: status === "APPROVED" ? "2026-09-17T02:00:00.000Z" : null,
    rejectionReason: null,
    assignedCoordinatorId,
  };
}

function listItem(id: string, name: string, assignedCoordinatorId: string | null, status = "SUBMITTED") {
  const r = record(id, name, assignedCoordinatorId, status);
  return {
    id: r.id,
    kind: "EVENT",
    status: r.status,
    name: r.name,
    reference: r.reference,
    lastSavedAt: null,
    submittedAt: r.submittedAt,
    assignedCoordinatorId,
    decidedAt: r.decidedAt,
  };
}

vi.mock("../src/api/events.js", async () => {
  const actual = await vi.importActual<typeof import("../src/api/events.js")>("../src/api/events.js");
  return {
    ...actual,
    listQueue: vi.fn(async () => ({
      items: [record("1", "Mine to review", ME), record("2", "Someone else's", OTHER)],
      nextCursor: null,
    })),
    // A4: the server lists a coordinator's own events only.
    listRequests: vi.fn(async () => ({
      items: [listItem("1", "Mine to review", ME), listItem("3", "Mine and approved", ME, "APPROVED")],
      nextCursor: null,
    })),
  };
});

vi.mock("../src/api/users.js", () => ({
  lookupUsers: vi.fn(async () => [
    { id: ME, displayName: "Coordinator One", email: "coordinator@connectsphere.test" },
    { id: OTHER, displayName: "Coordinator Two", email: "coordinator2@connectsphere.test" },
  ]),
}));

const { App } = await import("../src/App.js");

function signedIn(role: "EVENT_COORDINATOR" | "EVENT_ORGANISER", hash: string) {
  sessionStorage.setItem(
    "connectsphere.session",
    JSON.stringify({ userId: ME, email: "x@connectsphere.test", role, token: "t", lastLoginAt: "2026-09-17T01:00:00.000Z" })
  );
  window.location.hash = hash;
}

function rowFor(name: string) {
  return screen.getByText(name).closest("tr")!;
}

afterEach(() => {
  cleanup();
  sessionStorage.clear();
});

describe("the review queue", () => {
  it("marks the events assigned to the signed-in coordinator", async () => {
    signedIn("EVENT_COORDINATOR", "#/queue");
    render(<App />);
    await screen.findByText("Mine to review");

    expect(within(rowFor("Mine to review")).getByText("You")).toBeTruthy();
    expect(within(rowFor("Someone else's")).queryByText("You")).toBeNull();
    expect(await within(rowFor("Someone else's")).findByText("Coordinator Two")).toBeTruthy();
  });
});

describe("the All events screen", () => {
  it("is offered to coordinators", async () => {
    signedIn("EVENT_COORDINATOR", "#/queue");
    render(<App />);

    expect(await screen.findByRole("link", { name: "All events" })).toBeTruthy();
  });

  it("lists the coordinator's events, each marked as theirs, with no filter to apply (A4)", async () => {
    signedIn("EVENT_COORDINATOR", "#/events");
    render(<App />);
    await screen.findByText("Mine and approved");

    for (const name of ["Mine to review", "Mine and approved"]) {
      expect(within(rowFor(name)).getByText("You")).toBeTruthy();
    }
    expect(screen.queryByRole("button", { name: "Assigned to me" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Every event" })).toBeNull();
  });

  it("is not offered to organisers", async () => {
    signedIn("EVENT_ORGANISER", "#/events");
    render(<App />);

    expect(await screen.findByRole("heading", { name: "My requests" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "All events" })).toBeNull();
  });
});
