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
let flagsResponse: () => Response;
let impactResponse: () => Response;
const fetchMock = vi.fn(async (path: string, init?: RequestInit) => {
  const url = new URL(path, "http://app.test");
  if (url.pathname === "/event/api/v1/change-requests/c1/decision") return onDecision(JSON.parse(init!.body as string));
  if (url.pathname === "/event/api/v1/change-requests/c1/impact") return impactResponse();
  if (url.pathname === `/event/api/v1/events/${EVENT_ID}/change-requests`) return reply({ items: stored });
  if (url.pathname === `/event/api/v1/events/${EVENT_ID}/arrangement-flags`) return flagsResponse();
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
  flagsResponse = () => reply({ flags: [] });
  impactResponse = () => reply({ impact: { bookings: [], reservations: [], activeRegistrations: 0, flags: [] } });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  sessionStorage.clear();
  fetchMock.mockClear();
  vi.unstubAllGlobals();
});

describe("who sees Approve change and Reject change", () => {
  it("the assigned coordinator, on a pending request", async () => {
    asCoordinator();
    expect(await screen.findByRole("button", { name: "Approve change" })).toBeTruthy();
    expect(button("Reject change")).toBeTruthy();
  });

  it("keeps the event's own Approve and Reject distinct from the change's on an undecided event", async () => {
    current = event({ status: "UNDER_REVIEW", decidedBy: null, decidedAt: null });
    asCoordinator();
    await screen.findByRole("button", { name: "Approve change" });
    expect(screen.getAllByRole("button", { name: "Approve" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Reject" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Approve change" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Reject change" })).toHaveLength(1);
  });

  it("not a coordinator who is not assigned", async () => {
    asCoordinator("other-coordinator");
    await screen.findByText(/Change requested on/);
    expect(button("Approve change")).toBeNull();
    expect(button("Reject change")).toBeNull();
  });

  it("not the organiser", async () => {
    asOrganiser();
    await screen.findByText(/Change requested on/);
    expect(button("Approve change")).toBeNull();
  });

  it("not once the request is decided", async () => {
    stored = [approved];
    asCoordinator();
    await screen.findByText(/Change approved on/);
    expect(button("Approve change")).toBeNull();
    expect(button("Reject change")).toBeNull();
  });
});

describe("approving", () => {
  it("lists each field before and after, then posts APPROVE", async () => {
    asCoordinator();
    fireEvent.click(await screen.findByRole("button", { name: "Approve change" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/expected attendance: 150 → 180/)).toBeTruthy();
    expect(posts()).toHaveLength(0);
    stored = [approved];
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirm approval" }));
    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(JSON.parse(posts()[0]![1]!.body as string)).toEqual({ decision: "APPROVE" });
    expect(await screen.findByText(/Change approved on /)).toBeTruthy();
    expect(button("Approve change")).toBeNull();
  });

  it("shows the field messages when the change is no longer valid", async () => {
    onDecision = () => reply({ error: { code: "CHANGE_REQUEST_NO_LONGER_VALID", message: "The proposed values no longer pass the checks, so the change can't be approved. You can still reject it.", details: { fields: [{ field: "changes.expectedAttendance", message: "The venue now holds 100." }] }, correlationId: null } }, 409);
    asCoordinator();
    fireEvent.click(await screen.findByRole("button", { name: "Approve change" }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Confirm approval" }));
    expect(await screen.findByText("The venue now holds 100.")).toBeTruthy();
    expect(await screen.findByText(/no longer pass the checks/)).toBeTruthy();
  });
});

describe("rejecting", () => {
  async function openReject() {
    asCoordinator();
    fireEvent.click(await screen.findByRole("button", { name: "Reject change" }));
    return await screen.findByRole("dialog");
  }

  it("refuses an empty reason inline and sends nothing", async () => {
    const dialog = await openReject();
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirm rejection" }));
    expect(await screen.findByText("Give a reason for rejecting the change.")).toBeTruthy();
    expect(posts()).toHaveLength(0);
  });

  it("shows the server's reason error inline", async () => {
    onDecision = () => reply({ error: { code: "VALIDATION_FAILED", message: "x", fields: [{ field: "reason", message: "The reason can be at most 1000 characters." }], correlationId: null } }, 400);
    const dialog = await openReject();
    fireEvent.change(within(dialog).getByLabelText("Reason"), { target: { value: "no" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirm rejection" }));
    expect(await screen.findByText("The reason can be at most 1000 characters.")).toBeTruthy();
  });

  it("posts the reason and shows the outcome", async () => {
    const dialog = await openReject();
    fireEvent.change(within(dialog).getByLabelText("Reason"), { target: { value: "No larger hall" } });
    stored = [rejected];
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirm rejection" }));
    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(JSON.parse(posts()[0]![1]!.body as string)).toEqual({ decision: "REJECT", reason: "No larger hall" });
    expect(await screen.findByText(/Change rejected on .*: No larger hall/)).toBeTruthy();
  });

  it("shows an already-decided refusal", async () => {
    onDecision = () => reply({ error: { code: "CHANGE_REQUEST_ALREADY_DECIDED", message: "This change request was already approved on 2026-10-18.", correlationId: null } }, 409);
    const dialog = await openReject();
    fireEvent.change(within(dialog).getByLabelText("Reason"), { target: { value: "No larger hall" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirm rejection" }));
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

/** S3 — the impact list after an approval, and the Outstanding flags section. */
const B1 = "b1000000-0000-4000-8000-000000000001";
const B2 = "b2000000-0000-4000-8000-000000000002";
const R1 = "r1000000-0000-4000-8000-000000000001";
const Q1 = "q1000000-0000-4000-8000-000000000001";
const impact = {
  bookings: [
    { arrangement: "BOOKING", id: B1, reference: "BKG-000001", venueName: "Grand Theatre", startsAt: "2026-12-02T06:00:00.000Z", endsAt: "2026-12-02T10:00:00.000Z" },
    { arrangement: "BOOKING", id: B2, reference: "BKG-000002", venueName: "Main Hall", startsAt: "2026-12-02T06:00:00.000Z", endsAt: "2026-12-02T10:00:00.000Z" },
    { arrangement: "BOOKING_REQUEST", id: Q1, reference: "BKR-000003", venueName: "Lecture Hall C", startsAt: "2026-12-02T06:00:00.000Z", endsAt: "2026-12-02T10:00:00.000Z" },
  ],
  reservations: [{ id: R1, equipmentTypeName: "Projector", reservedQuantity: 2, startsAt: "2026-12-02T06:00:00.000Z", endsAt: "2026-12-02T10:00:00.000Z" }],
  activeRegistrations: 0,
  flags: [
    { arrangement: "BOOKING", id: B1, reference: "BKG-000001", name: "Grand Theatre", flag: "REQUIRES_RECONFIRMATION", reason: "The event's period changed." },
    { arrangement: "BOOKING", id: B1, reference: "BKG-000001", name: "Grand Theatre", flag: "UNSUITABLE", reason: "Expected attendance is now 150, but Grand Theatre holds 100 in the Theatre layout." },
    { arrangement: "BOOKING", id: B2, reference: "BKG-000002", name: "Main Hall", flag: "REQUIRES_RECONFIRMATION", reason: "The event's period changed." },
    { arrangement: "BOOKING_REQUEST", id: Q1, reference: "BKR-000003", name: "Lecture Hall C", flag: "REQUIRES_RECONFIRMATION", reason: "The booking request's period changed." },
    { arrangement: "EQUIPMENT", id: R1, reference: R1, name: "Projector", flag: "FLAGGED_FOR_REVIEW", reason: "The event's period changed; check the equipment is still free." },
  ],
};

async function approve() {
  asCoordinator();
  fireEvent.click(await screen.findByRole("button", { name: "Approve change" }));
  stored = [approved];
  fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Confirm approval" }));
  return await screen.findByText("Affected arrangements");
}

describe("the impact of an approval", () => {
  it("lists each booking and reservation with its flags and reasons, and the registrations", async () => {
    onDecision = () => reply({ changeRequest: approved, impact });
    await approve();
    expect(await screen.findByText("Affected arrangements")).toBeTruthy();
    expect(screen.getByText(/BKG-000001, Grand Theatre/)).toBeTruthy();
    expect(screen.getByText(/BKG-000002, Main Hall/)).toBeTruthy();
    expect(screen.getByText("Booking request BKR-000003, Lecture Hall C")).toBeTruthy();
    expect(screen.getByText(/Projector, quantity 2/)).toBeTruthy();
    expect(screen.getAllByText("Requires reconfirmation")).toHaveLength(3);
    expect(screen.getByText("Unsuitable")).toBeTruthy();
    expect(screen.getByText("Flagged for review")).toBeTruthy();
    expect(screen.getByText(/Expected attendance is now 150, but Grand Theatre holds 100/)).toBeTruthy();
    expect(screen.getByText(/check the equipment is still free/)).toBeTruthy();
    expect(screen.getByText("Registrations: 0")).toBeTruthy();
    expect(screen.queryByText(/No venue bookings or equipment reservations/)).toBeNull();
  });

  it("says so when no booking or reservation is affected", async () => {
    onDecision = () => reply({ changeRequest: approved, impact: { bookings: [], reservations: [], activeRegistrations: 3, flags: [] } });
    await approve();
    expect(await screen.findByText("No venue bookings or equipment reservations are affected.")).toBeTruthy();
    expect(screen.getByText("Registrations: 3")).toBeTruthy();
  });

  it("does not show an approval's impact once a later change request has been decided", async () => {
    onDecision = () => reply({ changeRequest: approved, impact });
    asCoordinator();
    fireEvent.click(await screen.findByRole("button", { name: "Approve change" }));
    // By the time the page reloads, the organiser has raised another change and it has been decided.
    stored = [approved, { ...rejected, id: "c2", decidedAt: "2026-10-19T02:00:00.000Z" }];
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Confirm approval" }));
    await screen.findByText(/Change rejected on /);
    expect(screen.queryByText("Affected arrangements")).toBeNull();
  });

  it("does not show an approval's impact while a new change request is pending", async () => {
    onDecision = () => reply({ changeRequest: approved, impact });
    asCoordinator();
    fireEvent.click(await screen.findByRole("button", { name: "Approve change" }));
    stored = [approved, { ...pending, id: "c2", requestedAt: "2026-10-19T02:00:00.000Z" }];
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Confirm approval" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(await screen.findByRole("region", { name: "Pending change" })).toBeTruthy();
    expect(screen.queryByText("Affected arrangements")).toBeNull();
  });

  it("shows no impact section after a rejection", async () => {
    onDecision = () => reply({ changeRequest: rejected });
    asCoordinator();
    fireEvent.click(await screen.findByRole("button", { name: "Reject change" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Reason"), { target: { value: "No larger hall" } });
    stored = [rejected];
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirm rejection" }));
    await screen.findByText(/Change rejected on /);
    expect(screen.queryByText("Affected arrangements")).toBeNull();
  });
});

describe("the Outstanding flags section", () => {
  const outstanding = impact.flags.map((flag) => ({ ...flag, flaggedAt: "2026-10-28T02:00:00.000Z" }));

  it("lists each flag with its arrangement, reference, name, label and reason, to the coordinator", async () => {
    flagsResponse = () => reply({ flags: outstanding });
    stored = [approved];
    asCoordinator();
    expect(await screen.findByText("Outstanding flags")).toBeTruthy();
    expect(screen.getByText("Equipment " + R1 + ", Projector")).toBeTruthy();
    expect(screen.getAllByText(/Booking BKG-000001, Grand Theatre/)).toHaveLength(2);
    expect(screen.getByText("Booking request BKR-000003, Lecture Hall C")).toBeTruthy();
    expect(screen.getByText("Unsuitable")).toBeTruthy();
    expect(screen.getByText(/holds 100 in the Theatre layout/)).toBeTruthy();
  });

  it("is shown on the organiser's page too", async () => {
    flagsResponse = () => reply({ flags: outstanding });
    stored = [approved];
    asOrganiser();
    expect(await screen.findByText("Outstanding flags")).toBeTruthy();
  });

  it("is hidden when there are no flags", async () => {
    stored = [approved];
    asCoordinator();
    await screen.findByText(/Change approved on/);
    await waitFor(() => expect(fetchMock.mock.calls.some(([path]) => String(path).includes("arrangement-flags"))).toBe(true));
    expect(screen.queryByText("Outstanding flags")).toBeNull();
  });

  it("is hidden when the route answers 404", async () => {
    flagsResponse = () => reply({ error: { code: "NOT_FOUND", message: "Not found", correlationId: null } }, 404);
    stored = [approved];
    asOrganiser();
    await screen.findByText(/Change approved on/);
    await waitFor(() => expect(fetchMock.mock.calls.some(([path]) => String(path).includes("arrangement-flags"))).toBe(true));
    expect(screen.queryByText("Outstanding flags")).toBeNull();
  });
});

/** G2 — the preview of what approving a pending change would affect. */
const impactCalls = () => fetchMock.mock.calls.filter(([path]) => String(path).endsWith("/impact"));
const ALREADY_DECIDED = { error: { code: "CHANGE_REQUEST_ALREADY_DECIDED", message: "Already decided.", correlationId: null } };

describe("the preview of a pending change", () => {
  it("lists each arrangement with the flags approval would set and their reasons, above the actions", async () => {
    impactResponse = () => reply({ impact });
    asCoordinator();
    const heading = await screen.findByText("If this change is approved");
    expect(screen.getByText(/BKG-000001, Grand Theatre/)).toBeTruthy();
    expect(screen.getByText(/BKG-000002, Main Hall/)).toBeTruthy();
    expect(screen.getByText(/Projector, quantity 2/)).toBeTruthy();
    expect(screen.getAllByText("Requires reconfirmation")).toHaveLength(3);
    expect(screen.getByText("Unsuitable")).toBeTruthy();
    expect(screen.getByText("Flagged for review")).toBeTruthy();
    expect(screen.getByText(/Expected attendance is now 150, but Grand Theatre holds 100/)).toBeTruthy();
    expect(screen.getByText("Registrations: 0")).toBeTruthy();
    expect(screen.queryByText("Affected arrangements")).toBeNull();
    const approve = screen.getByRole("button", { name: "Approve change" });
    expect(heading.compareDocumentPosition(approve) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(posts()).toHaveLength(0);
  });

  it("uses the conditional wording when nothing would be affected", async () => {
    asCoordinator();
    expect(await screen.findByText("No venue bookings or equipment reservations would be affected.")).toBeTruthy();
    expect(screen.queryByText("No venue bookings or equipment reservations are affected.")).toBeNull();
  });

  it("is hidden, and never requested, for a decided request", async () => {
    stored = [approved];
    asCoordinator();
    await screen.findByText(/Change approved on/);
    expect(screen.queryByText("If this change is approved")).toBeNull();
    expect(impactCalls()).toHaveLength(0);
  });

  it("is hidden when the request was decided meanwhile (409)", async () => {
    impactResponse = () => reply(ALREADY_DECIDED, 409);
    asCoordinator();
    await screen.findByRole("button", { name: "Approve change" });
    await waitFor(() => expect(impactCalls()).toHaveLength(1));
    await waitFor(() => expect(screen.queryByText(/Loading what this change would affect/)).toBeNull());
    expect(screen.queryByText("If this change is approved")).toBeNull();
    expect(screen.queryByText(/couldn't be loaded/)).toBeNull();
  });

  it("is hidden on 404", async () => {
    impactResponse = () => reply({ error: { code: "CHANGE_REQUEST_NOT_FOUND", message: "Not found", correlationId: null } }, 404);
    asCoordinator();
    await screen.findByRole("button", { name: "Approve change" });
    await waitFor(() => expect(screen.queryByText(/Loading what this change would affect/)).toBeNull());
    expect(screen.queryByText("If this change is approved")).toBeNull();
  });

  it("says so when it can't be loaded, and leaves the decision available", async () => {
    impactResponse = () => reply({ error: { code: "INTERNAL", message: "boom", correlationId: null } }, 500);
    asCoordinator();
    expect(await screen.findByText("What this change would affect couldn't be loaded.")).toBeTruthy();
    expect(button("Approve change")).toBeTruthy();
  });

  it("disappears once the request is decided", async () => {
    impactResponse = () => reply({ impact });
    asCoordinator();
    await screen.findByText("If this change is approved");
    fireEvent.click(await screen.findByRole("button", { name: "Reject change" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Reason"), { target: { value: "No larger hall" } });
    onDecision = () => reply({ changeRequest: rejected });
    stored = [rejected];
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirm rejection" }));
    await screen.findByText(/Change rejected on /);
    expect(screen.queryByText("If this change is approved")).toBeNull();
  });
});
