import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ApiError } from "../src/api/client.js";

/**
 * D5 — a rejection without a reason is refused. The refusal must be visible in
 * the rejection dialog, where the reason is entered (implementation.md §7.1),
 * not on the page hidden behind it.
 */

const EVENT_ID = "event-under-review";

vi.mock("../src/api/events.js", async () => {
  const actual = await vi.importActual<typeof import("../src/api/events.js")>("../src/api/events.js");
  return {
    ...actual,
    openEvent: vi.fn(async () => ({
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
      reviewingCoordinatorId: "coordinator-id",
      reviewStartedAt: "2026-09-17T01:05:00.000Z",
      decidedBy: null,
      decidedAt: null,
      rejectionReason: null,
      assignedCoordinatorId: "coordinator-id",
    })),
    listClarifications: vi.fn(async () => ({ items: [], nextCursor: null })),
    rejectEvent: vi.fn(async () => {
      throw new ApiError(400, {
        code: "VALIDATION_FAILED",
        message: "A reason is required to reject an event request.",
        fields: [{ field: "reason", message: "A reason is required." }],
        correlationId: null,
      });
    }),
  };
});

vi.mock("../src/api/users.js", () => ({ lookupUsers: vi.fn(async () => []) }));

const { App } = await import("../src/App.js");

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
  window.location.hash = `#/review/${EVENT_ID}`;
});

afterEach(() => {
  cleanup();
  sessionStorage.clear();
});

describe("rejecting without a reason", () => {
  it("shows the refusal inside the rejection dialog", async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Reject" }));

    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Reject request" }));

    expect(await within(dialog).findByText("A reason is required to reject an event request.")).toBeTruthy();
    expect(within(dialog).getByText("A reason is required.")).toBeTruthy();
  });

  it("clears the refusal when the dialog is opened again", async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Reject" }));
    let dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Reject request" }));
    await within(dialog).findByText("A reason is required to reject an event request.");

    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    dialog = await screen.findByRole("dialog");

    expect(within(dialog).queryByText("A reason is required to reject an event request.")).toBeNull();
  });
});
