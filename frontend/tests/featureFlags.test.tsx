import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

/**
 * EN-15-T7 — the change-decision screen follows the change-approval flag. Only the HTTP boundary is
 * stubbed. The server enforces the flag on the action (EN-15-T3); this is what the coordinator sees.
 */
const EVENT_ID = "e1000000-0000-4000-8000-000000000001";
const OWNER = "organiser-id";
const COORDINATOR = "coordinator-id";

const event = {
  id: EVENT_ID, reference: "EVT-000001", ownerId: OWNER, name: "Annual Research Symposium",
  purpose: "Share faculty research", description: "A one-day symposium.",
  proposedStartAt: "2026-12-02T06:00:00.000Z", proposedEndAt: "2026-12-02T10:00:00.000Z",
  expectedAttendance: 150, venueRequirements: null, accessibilityNeeds: null,
  equipmentRequired: false, equipmentRequirements: null, registrationRequired: false,
  registrationOpensAt: null, registrationClosesAt: null, status: "APPROVED",
  submittedAt: "2026-09-17T01:00:00.000Z", lastSavedAt: "2026-09-17T01:00:00.000Z",
  reviewingCoordinatorId: COORDINATOR, reviewStartedAt: null, decidedBy: COORDINATOR,
  decidedAt: "2026-09-18T01:00:00.000Z", rejectionReason: null, assignedCoordinatorId: COORDINATOR,
  contactDetails: null, version: 1,
};
const pending = {
  id: "c1", eventId: EVENT_ID, eventReference: "EVT-000001", status: "PENDING", reason: "More people",
  requestedBy: OWNER, requestedAt: "2026-10-17T02:00:00.000Z", decidedBy: null, decidedAt: null, rejectionReason: null,
  fields: [{ fieldName: "expectedAttendance", currentValue: 150, proposedValue: 180 }],
};

vi.mock("../src/api/events.js", async () => {
  const actual = await vi.importActual<typeof import("../src/api/events.js")>("../src/api/events.js");
  return {
    ...actual,
    openEvent: async () => event,
    listClarifications: async () => ({ items: [], nextCursor: null }),
    listReassignmentProposals: async () => ({ items: [], nextCursor: null }),
  };
});
vi.mock("../src/api/users.js", () => ({ lookupUsers: vi.fn(async () => []) }));
const { App } = await import("../src/App.js");

const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
let featureFlags: () => Response;
const fetchMock = vi.fn(async (path: string) => {
  const url = new URL(path, "http://app.test");
  if (url.pathname === "/event/api/v1/feature-flags") return featureFlags();
  if (url.pathname === `/event/api/v1/events/${EVENT_ID}/change-requests`) return reply({ items: [pending] });
  if (url.pathname.includes("/notifications")) return reply({ items: [], unreadCount: 0, nextCursor: null });
  return reply({ items: [] });
});

function openAsCoordinator() {
  sessionStorage.setItem(
    "connectsphere.session",
    JSON.stringify({ userId: COORDINATOR, email: "c@connectsphere.test", role: "EVENT_COORDINATOR", token: "t", lastLoginAt: "2026-10-17T00:00:00.000Z" }),
  );
  window.location.hash = `#/review/${EVENT_ID}`;
  render(<App />);
}

beforeEach(() => {
  featureFlags = () => reply({ flags: { "change-approval": true } });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  sessionStorage.clear();
  fetchMock.mockClear();
  vi.unstubAllGlobals();
});

const approve = () => screen.findByRole("button", { name: "Approve change" });
const isDisabled = (element: HTMLElement) => (element as HTMLButtonElement).disabled;

describe("the change-decision screen and the change-approval flag", () => {
  it("EN-15-T7 enables Approve change while the flag is on", async () => {
    openAsCoordinator();
    const button = await approve();
    await waitFor(() => expect(fetchMock.mock.calls.some(([path]) => String(path).endsWith("/feature-flags"))).toBe(true));
    expect(isDisabled(button)).toBe(false);
    expect(screen.queryByText(/switched off right now/)).toBeNull();
  });

  it("EN-15-T7 disables Approve change and says why while the flag is off, and Reject change still opens", async () => {
    featureFlags = () => reply({ flags: { "change-approval": false } });
    openAsCoordinator();

    expect(await screen.findByText(/Approving change requests is switched off right now/)).toBeTruthy();
    expect(isDisabled(await approve())).toBe(true);
    const reject = screen.getByRole("button", { name: "Reject change" });
    expect(isDisabled(reject)).toBe(false);
    fireEvent.click(reject);
    expect(await screen.findByRole("dialog")).toBeTruthy();
  });

  it("EN-15-T7 leaves Approve change enabled when the flags cannot be read, because the server still enforces the flag", async () => {
    featureFlags = () => reply({ error: { code: "RATE_LIMITED", message: "Slow down", correlationId: null } }, 429);
    openAsCoordinator();

    const button = await approve();
    await waitFor(() => expect(fetchMock.mock.calls.some(([path]) => String(path).endsWith("/feature-flags"))).toBe(true));
    expect(isDisabled(button)).toBe(false);
    expect(screen.queryByText(/switched off right now/)).toBeNull();
  });
});
