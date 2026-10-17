import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

/** S2 — deciding a change request on the review page and the outcome on both pages. Only the HTTP boundary is stubbed. */
const EVENT_ID = "e1000000-0000-4000-8000-000000000001";
const OWNER = "organiser-id";
const COORDINATOR = "coordinator-id";

function event(overrides: Record<string, unknown> = {}) {
  return {
    id: EVENT_ID, reference: "EVT-000001", ownerId: OWNER, name: "Annual Research Symposium",
    purpose: "Share faculty research", description: "A one-day symposium.",
    proposedStartAt: "2026-12-02T06:00:00.000Z", proposedEndAt: "2026-12-02T10:00:00.000Z",
    expectedAttendance: 150, venueRequirements: null, accessibilityNeeds: null,
    equipmentRequired: false, equipmentRequirements: null, registrationRequired: false,
    registrationOpensAt: null, registrationClosesAt: null, status: "APPROVED",
    submittedAt: "2026-09-17T01:00:00.000Z", lastSavedAt: "2026-09-17T01:00:00.000Z",
    reviewingCoordinatorId: COORDINATOR, reviewStartedAt: null, decidedBy: COORDINATOR,
    decidedAt: "2026-09-18T01:00:00.000Z", rejectionReason: null, assignedCoordinatorId: COORDINATOR,
    contactDetails: null, version: 1, ...overrides,
  };
}

const pending = {
  id: "c1", eventId: EVENT_ID, eventReference: "EVT-000001", status: "PENDING", reason: "More people",
  requestedBy: OWNER, requestedAt: "2026-10-17T02:00:00.000Z", decidedBy: null, decidedAt: null, rejectionReason: null,
  fields: [{ fieldName: "expectedAttendance", currentValue: 150, proposedValue: 180 }],
};
const approved = { ...pending, status: "APPROVED", decidedBy: COORDINATOR, decidedAt: "2026-10-18T02:00:00.000Z" };
const rejected = { ...pending, status: "REJECTED", decidedBy: COORDINATOR, decidedAt: "2026-10-18T02:00:00.000Z", rejectionReason: "No larger hall" };

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
let stored: unknown[];
let onDecision: (body: Record<string, unknown>) => Response;
const fetchMock = vi.fn(async (path: string, init?: RequestInit) => {
  const url = new URL(path, "http://app.test");
  if (url.pathname === "/event/api/v1/change-requests/c1/decision") return onDecision(JSON.parse(init!.body as string));
  if (url.pathname === `/event/api/v1/events/${EVENT_ID}/change-requests`) return reply({ items: stored });
  if (url.pathname.includes("/notifications")) return reply({ items: [], unreadCount: 0, nextCursor: null });
  return reply({ items: [] });
});
const posts = () => fetchMock.mock.calls.filter(([, init]) => init?.method === "POST");

function open(userId: string, role: string, path: string) {
  sessionStorage.setItem("connectsphere.session", JSON.stringify({ userId, email: "u@connectsphere.test", role, token: "t", lastLoginAt: "2026-10-17T00:00:00.000Z" }));
  window.location.hash = `#${path}`;
  render(<App />);
}
const asCoordinator = (id = COORDINATOR) => open(id, "EVENT_COORDINATOR", `/review/${EVENT_ID}`);
const asOrganiser = () => open(OWNER, "EVENT_ORGANISER", `/requests/${EVENT_ID}`);
const button = (name: string) => screen.queryByRole("button", { name });

beforeEach(() => {
  current = event();
  stored = [pending];
  onDecision = () => reply({ changeRequest: approved });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  sessionStorage.clear();
  fetchMock.mockClear();
  vi.unstubAllGlobals();
});

describe("who sees Approve and Reject", () => {
  it("the assigned coordinator, on a pending request", async () => {
    asCoordinator();
    expect(await screen.findByRole("button", { name: "Approve" })).toBeTruthy();
    expect(button("Reject")).toBeTruthy();
  });

  it("not a coordinator who is not assigned", async () => {
    asCoordinator("other-coordinator");
    await screen.findByText(/Change requested on/);
    expect(button("Approve")).toBeNull();
    expect(button("Reject")).toBeNull();
  });

  it("not the organiser", async () => {
    asOrganiser();
    await screen.findByText(/Change requested on/);
    expect(button("Approve")).toBeNull();
  });

  it("not once the request is decided", async () => {
    stored = [approved];
    asCoordinator();
    await screen.findByText(/Change approved on/);
    expect(button("Approve")).toBeNull();
    expect(button("Reject")).toBeNull();
  });
});

describe("approving", () => {
  it("lists each field before and after, then posts APPROVE", async () => {
    asCoordinator();
    fireEvent.click(await screen.findByRole("button", { name: "Approve" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/expected attendance: 150 → 180/)).toBeTruthy();
    expect(posts()).toHaveLength(0);
    stored = [approved];
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirm approval" }));
    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(JSON.parse(posts()[0]![1]!.body as string)).toEqual({ decision: "APPROVE" });
    expect(await screen.findByText(/Change approved on /)).toBeTruthy();
    expect(button("Approve")).toBeNull();
  });

  it("shows the field messages when the change is no longer valid", async () => {
    onDecision = () => reply({ error: { code: "CHANGE_REQUEST_NO_LONGER_VALID", message: "The proposed values no longer pass the checks, so the change can't be approved. You can still reject it.", details: { fields: [{ field: "changes.expectedAttendance", message: "The venue now holds 100." }] }, correlationId: null } }, 409);
    asCoordinator();
    fireEvent.click(await screen.findByRole("button", { name: "Approve" }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Confirm approval" }));
    expect(await screen.findByText("The venue now holds 100.")).toBeTruthy();
    expect(await screen.findByText(/no longer pass the checks/)).toBeTruthy();
  });
});

describe("rejecting", () => {
  async function openReject() {
    asCoordinator();
    fireEvent.click(await screen.findByRole("button", { name: "Reject" }));
    return await screen.findByRole("dialog");
  }

  it("refuses an empty reason inline and sends nothing", async () => {
    const dialog = await openReject();
    fireEvent.click(within(dialog).getByRole("button", { name: "Reject change" }));
    expect(await screen.findByText("Give a reason for rejecting the change.")).toBeTruthy();
    expect(posts()).toHaveLength(0);
  });

  it("shows the server's reason error inline", async () => {
    onDecision = () => reply({ error: { code: "VALIDATION_FAILED", message: "x", fields: [{ field: "reason", message: "The reason can be at most 1000 characters." }], correlationId: null } }, 400);
    const dialog = await openReject();
    fireEvent.change(within(dialog).getByLabelText("Reason"), { target: { value: "no" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Reject change" }));
    expect(await screen.findByText("The reason can be at most 1000 characters.")).toBeTruthy();
  });

  it("posts the reason and shows the outcome", async () => {
    const dialog = await openReject();
    fireEvent.change(within(dialog).getByLabelText("Reason"), { target: { value: "No larger hall" } });
    stored = [rejected];
    fireEvent.click(within(dialog).getByRole("button", { name: "Reject change" }));
    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(JSON.parse(posts()[0]![1]!.body as string)).toEqual({ decision: "REJECT", reason: "No larger hall" });
    expect(await screen.findByText(/Change rejected on .*: No larger hall/)).toBeTruthy();
  });

  it("shows an already-decided refusal", async () => {
    onDecision = () => reply({ error: { code: "CHANGE_REQUEST_ALREADY_DECIDED", message: "This change request was already approved on 2026-10-18.", correlationId: null } }, 409);
    const dialog = await openReject();
    fireEvent.change(within(dialog).getByLabelText("Reason"), { target: { value: "No larger hall" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Reject change" }));
    expect(await screen.findByText(/already approved on/)).toBeTruthy();
  });
});

describe("the organiser's page", () => {
  it("shows an approved outcome and offers Request a change again", async () => {
    stored = [approved];
    asOrganiser();
    expect(await screen.findByText(/Change approved on /)).toBeTruthy();
    expect(button("Request a change")).toBeTruthy();
  });

  it("shows a rejected outcome with the reason and offers Request a change again", async () => {
    stored = [rejected];
    asOrganiser();
    expect(await screen.findByText(/Change rejected on .*: No larger hall/)).toBeTruthy();
    expect(button("Request a change")).toBeTruthy();
  });

  it("shows the latest decided request when several exist", async () => {
    stored = [{ ...approved, id: "c0", decidedAt: "2026-10-01T02:00:00.000Z" }, rejected];
    asOrganiser();
    expect(await screen.findByText(/Change rejected on /)).toBeTruthy();
    expect(screen.queryByText(/Change approved on /)).toBeNull();
  });
});
