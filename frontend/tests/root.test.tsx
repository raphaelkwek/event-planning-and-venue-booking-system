import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

/**
 * The app as mounted by main.tsx must be able to show Atlaskit modals. Atlaskit's
 * portal detaches its container when React StrictMode replays effects, so a
 * modal rendered under StrictMode never reaches the page.
 */

vi.mock("../src/api/events.js", async () => {
  const actual = await vi.importActual<typeof import("../src/api/events.js")>("../src/api/events.js");
  return {
    ...actual,
    openEvent: vi.fn(async () => ({
      id: "event-under-review",
      reference: "EVT-000001",
      ownerId: "organiser-id",
      name: "Annual Research Symposium",
      purpose: null,
      description: null,
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
      reviewingCoordinatorId: "coordinator-id",
      reviewStartedAt: "2026-09-17T01:05:00.000Z",
      decidedBy: null,
      decidedAt: null,
      rejectionReason: null,
      assignedCoordinatorId: "coordinator-id",
    })),
    listClarifications: vi.fn(async () => ({ items: [], nextCursor: null })),
    listReassignmentProposals: vi.fn(async () => ({ items: [], nextCursor: null })),
  };
});

vi.mock("../src/api/users.js", () => ({ lookupUsers: vi.fn(async () => []) }));

const { Root } = await import("../src/Root.js");

beforeEach(() => {
  sessionStorage.setItem(
    "connectsphere.session",
    JSON.stringify({
      userId: "coordinator-id",
      email: "coordinator@connectsphere.test",
      role: "EVENT_COORDINATOR",
      token: "token",
      lastLoginAt: "2026-09-17T01:00:00.000Z",
    })
  );
  window.location.hash = "#/review/event-under-review";
});

afterEach(() => {
  cleanup();
  sessionStorage.clear();
});

describe("the mounted app", () => {
  it("shows the rejection dialog attached to the page", async () => {
    render(<Root />);
    fireEvent.click(await screen.findByRole("button", { name: "Reject" }));

    const dialog = await screen.findByRole("dialog");
    expect(document.body.contains(dialog)).toBe(true);
  });

  it("names the signed-in role in words, not as its code", async () => {
    render(<Root />);

    const header = (await screen.findByRole("button", { name: "Sign out" })).parentElement!;
    expect(header.textContent).toContain("Event Coordinator");
    expect(header.textContent).not.toContain("EVENT_COORDINATOR");
  });
});
