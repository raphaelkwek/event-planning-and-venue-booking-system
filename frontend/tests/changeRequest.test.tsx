import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

/** S1 — requesting a change from the request page, and the pending notice on both pages. Only the HTTP boundary is stubbed. */
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
  requestedBy: OWNER, requestedAt: "2026-10-17T02:00:00.000Z",
  fields: [{ fieldName: "expectedAttendance", currentValue: 150, proposedValue: 180 }],
};

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
let listFails = false;
let onPost: (body: Record<string, unknown>) => Response;
const fetchMock = vi.fn(async (path: string, init?: RequestInit) => {
  const url = new URL(path, "http://app.test");
  if (url.pathname === `/event/api/v1/events/${EVENT_ID}/change-requests`) {
    if (init?.method === "POST") return onPost(JSON.parse(init.body as string));
    if (listFails) return reply({ error: { code: "INTERNAL", message: "boom", correlationId: null } }, 500);
    return reply({ items: stored });
  }
  if (url.pathname.includes("/notifications")) return reply({ items: [], unreadCount: 0, nextCursor: null });
  return reply({ items: [] });
});
const posts = () => fetchMock.mock.calls.filter(([, init]) => init?.method === "POST");

function open(userId: string, role: string, path: string) {
  sessionStorage.setItem("connectsphere.session", JSON.stringify({ userId, email: "u@connectsphere.test", role, token: "t", lastLoginAt: "2026-10-17T00:00:00.000Z" }));
  window.location.hash = `#${path}`;
  render(<App />);
}
const asOrganiser = () => open(OWNER, "EVENT_ORGANISER", `/requests/${EVENT_ID}`);
const requestButton = () => screen.queryByRole("button", { name: "Request a change" });

beforeEach(() => {
  current = event();
  stored = [];
  listFails = false;
  onPost = () => reply(pending, 201);
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  sessionStorage.clear();
  fetchMock.mockClear();
  vi.unstubAllGlobals();
});

async function openForm() {
  asOrganiser();
  fireEvent.click(await screen.findByRole("button", { name: "Request a change" }));
  return (await screen.findByLabelText("Expected attendance", { selector: "#change-attendance" })) as HTMLInputElement;
}
const send = () => fireEvent.click(screen.getByRole("button", { name: "Send request" }));

describe("the Request a change button", () => {
  it.each(["SUBMITTED", "UNDER_REVIEW", "AWAITING_CLARIFICATION", "APPROVED", "PLANNING", "SAFETY_REVIEW", "CONFIRMED"])("is offered for %s", async (status) => {
    current = event({ status });
    asOrganiser();
    expect(await screen.findByRole("button", { name: "Request a change" })).toBeTruthy();
  });

  it.each(["DRAFT", "COMPLETED", "CANCELLED", "REJECTED"])("is not offered for %s", async (status) => {
    current = event({ status });
    asOrganiser();
    await screen.findByRole("heading", { name: "Annual Research Symposium" });
    expect(requestButton()).toBeNull();
  });

  it("is not offered while a request is pending, and the notice is shown instead", async () => {
    stored = [pending];
    asOrganiser();
    expect(await screen.findByText(/Change requested on .*: expected attendance \(Pending\)/)).toBeTruthy();
    expect(requestButton()).toBeNull();
  });
});

describe("when the change requests cannot be loaded", () => {
  it("says so and does not offer the button on the organiser's page", async () => {
    listFails = true;
    asOrganiser();
    expect(await screen.findByText("Change requests couldn't be loaded.")).toBeTruthy();
    expect(requestButton()).toBeNull();
  });

  it("says so on the coordinator's page", async () => {
    listFails = true;
    open(COORDINATOR, "EVENT_COORDINATOR", `/review/${EVENT_ID}`);
    expect(await screen.findByText("Change requests couldn't be loaded.")).toBeTruthy();
  });
});

describe("the form", () => {
  it("is prefilled, and sends nothing when nothing changed", async () => {
    const attendance = await openForm();
    expect(attendance.value).toBe("150");
    send();
    expect(await screen.findByText("You haven't changed anything.")).toBeTruthy();
    expect(posts()).toHaveLength(0);
  });

  it("sends only the changed field and the reason", async () => {
    const attendance = await openForm();
    fireEvent.change(attendance, { target: { value: "180" } });
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "More people" } });
    send();
    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(JSON.parse(posts()[0]![1]!.body as string)).toEqual({ reason: "More people", changes: { expectedAttendance: 180 } });
  });

  it("shows a field error beside its control", async () => {
    onPost = () => reply({ error: { code: "VALIDATION_FAILED", message: "Check the highlighted fields.", fields: [{ field: "changes.expectedAttendance", message: "The venue holds 100." }], correlationId: null } }, 400);
    const attendance = await openForm();
    fireEvent.change(attendance, { target: { value: "500" } });
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "More people" } });
    send();
    const message = await screen.findByText("The venue holds 100.");
    expect(attendance.parentElement!.parentElement!.contains(message)).toBe(true);
  });

  it("shows the reason's refusal beside the reason", async () => {
    onPost = () => reply({ error: { code: "VALIDATION_FAILED", message: "x", fields: [{ field: "reason", message: "Give a reason." }], correlationId: null } }, 400);
    const attendance = await openForm();
    fireEvent.change(attendance, { target: { value: "180" } });
    send();
    expect(await screen.findByText("Give a reason.")).toBeTruthy();
  });

  it("shows the message of an already-pending refusal", async () => {
    onPost = () => reply({ error: { code: "CHANGE_REQUEST_ALREADY_PENDING", message: "A change request for this event is already pending, made on 2026-10-17.", correlationId: null } }, 409);
    const attendance = await openForm();
    fireEvent.change(attendance, { target: { value: "180" } });
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "More people" } });
    send();
    expect(await screen.findByText(/already pending, made on/)).toBeTruthy();
  });

  it("shows the pending notice and hides the button once sent", async () => {
    const attendance = await openForm();
    fireEvent.change(attendance, { target: { value: "180" } });
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "More people" } });
    onPost = () => {
      stored = [pending];
      return reply(pending, 201);
    };
    send();
    expect(await screen.findByText(/Change requested on .*: expected attendance \(Pending\)/)).toBeTruthy();
    expect(requestButton()).toBeNull();
  });
});

describe("the coordinator's review page", () => {
  it("shows the same pending notice", async () => {
    stored = [pending];
    open(COORDINATOR, "EVENT_COORDINATOR", `/review/${EVENT_ID}`);
    expect(await screen.findByText(/Change requested on .*: expected attendance \(Pending\)/)).toBeTruthy();
  });
});
