import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

/**
 * E2 — reassignment is only permitted while a request is still open, so the
 * review screen must not offer "Propose reassignment" once a decision has been
 * recorded. Found by E2-T7: the button was rendered disabled instead of hidden,
 * which reads as "you may do this, later" for something that can never be done.
 */

const EVENT_ID = "event-under-review";
const COORDINATOR_ID = "coordinator-id";

function event(overrides: Record<string, unknown> = {}) {
  return {
    id: EVENT_ID,
    reference: "EVT-000001",
    ownerId: "organiser-id",
    name: "Annual Research Symposium",
    purpose: "Share faculty research",
    description: "A one-day symposium.",
    proposedStartAt: "2026-12-02T06:00:00.000Z",
    proposedEndAt: "2026-12-02T10:00:00.000Z",
    expectedAttendance: 150,
    venueRequirements: null,
    accessibilityNeeds: null,
    equipmentRequired: false,
    equipmentRequirements: null,
    registrationRequired: false,
    registrationOpensAt: null,
    registrationClosesAt: null,
    status: "UNDER_REVIEW",
    submittedAt: "2026-09-17T01:00:00.000Z",
    lastSavedAt: "2026-09-17T01:00:00.000Z",
    reviewingCoordinatorId: COORDINATOR_ID,
    reviewStartedAt: "2026-09-17T01:05:00.000Z",
    decidedBy: null,
    decidedAt: null,
    rejectionReason: null,
    assignedCoordinatorId: COORDINATOR_ID,
    ...overrides,
  };
}

const openEvent = vi.fn(async () => event());

vi.mock("../src/api/events.js", async () => {
  const actual = await vi.importActual<typeof import("../src/api/events.js")>("../src/api/events.js");
  return {
    ...actual,
    openEvent: (...args: unknown[]) => openEvent(...(args as [])),
    listClarifications: vi.fn(async () => ({ items: [], nextCursor: null })),
    listReassignmentProposals: vi.fn(async () => ({ items: [], nextCursor: null })),
  };
});

vi.mock("../src/api/users.js", () => ({ lookupUsers: vi.fn(async () => []) }));

const { App } = await import("../src/App.js");

beforeEach(() => {
  sessionStorage.setItem(
    "connectsphere.session",
    JSON.stringify({
      userId: COORDINATOR_ID,
      email: "coordinator@connectsphere.test",
      role: "EVENT_COORDINATOR",
      token: "token",
      lastLoginAt: "2026-09-17T01:00:00.000Z",
    })
  );
  window.location.hash = `#/review/${EVENT_ID}`;
});

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.clearAllMocks();
});

describe("offering a reassignment", () => {
  it("offers it while the request is still under review", async () => {
    render(<App />);

    expect(await screen.findByRole("button", { name: "Propose reassignment" })).toBeTruthy();
  });

  it("does not offer it once the request has been rejected", async () => {
    openEvent.mockImplementation(async () =>
      event({
        status: "REJECTED",
        decidedBy: COORDINATOR_ID,
        decidedAt: "2026-09-18T02:00:00.000Z",
        rejectionReason: "No suitable venue is available.",
      })
    );
    render(<App />);

    await screen.findByRole("heading", { name: "Annual Research Symposium" });
    expect(screen.queryByRole("button", { name: "Propose reassignment" })).toBeNull();
  });

  it("does not offer it once the request has been approved", async () => {
    openEvent.mockImplementation(async () =>
      event({ status: "APPROVED", decidedBy: COORDINATOR_ID, decidedAt: "2026-09-18T02:00:00.000Z" })
    );
    render(<App />);

    await screen.findByRole("heading", { name: "Annual Research Symposium" });
    expect(screen.queryByRole("button", { name: "Propose reassignment" })).toBeNull();
  });
});
