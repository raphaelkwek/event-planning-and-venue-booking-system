import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

/**
 * A3 — a coordinator's list contains every event, whoever it is assigned to,
 * with the events assigned to them distinguishable from the rest.
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
    listRequests: vi.fn(async () => ({
      items: [
        listItem("1", "Mine to review", ME),
        listItem("2", "Someone else's", OTHER),
        listItem("3", "Mine and approved", ME, "APPROVED"),
        listItem("4", "Nobody's yet", null),
      ],
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

  it("lists every event whoever it is assigned to, marking the coordinator's own", async () => {
    signedIn("EVENT_COORDINATOR", "#/events");
    render(<App />);
    await screen.findByText("Mine and approved");

    for (const name of ["Mine to review", "Someone else's", "Mine and approved", "Nobody's yet"]) {
      expect(screen.getByText(name)).toBeTruthy();
    }
    expect(within(rowFor("Mine and approved")).getByText("You")).toBeTruthy();
    expect(within(rowFor("Nobody's yet")).getByText("Awaiting assignment")).toBeTruthy();
  });

  it("can be filtered to the events assigned to the signed-in coordinator", async () => {
    signedIn("EVENT_COORDINATOR", "#/events");
    render(<App />);
    await screen.findByText("Mine and approved");

    fireEvent.click(screen.getByRole("button", { name: "Assigned to me" }));

    expect(screen.getByText("Mine to review")).toBeTruthy();
    expect(screen.getByText("Mine and approved")).toBeTruthy();
    expect(screen.queryByText("Someone else's")).toBeNull();
    expect(screen.queryByText("Nobody's yet")).toBeNull();
  });

  it("is not offered to organisers", async () => {
    signedIn("EVENT_ORGANISER", "#/events");
    render(<App />);

    expect(await screen.findByRole("heading", { name: "My requests" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "All events" })).toBeNull();
  });
});
