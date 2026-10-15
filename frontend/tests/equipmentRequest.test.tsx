import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { App } from "../src/App.js";

// O1: the coordinator's equipment request screen, through the real fetch client. Only the HTTP boundary is stubbed.
const EVENT_ID = "e1000000-0000-4000-8000-000000000001";
const COORDINATOR = "c1000000-0000-4000-8000-000000000001";
const OTHER_COORDINATOR = "c2000000-0000-4000-8000-000000000002";
const CHAIRS = "70000000-0000-4000-8000-000000000001";
const PROJECTORS = "70000000-0000-4000-8000-000000000002";

const event = (assignedCoordinatorId: string | null = COORDINATOR) => ({
  id: EVENT_ID,
  reference: "EVT-000123",
  name: "Annual Research Symposium",
  ownerId: "0w",
  proposedStartAt: "2026-12-02T06:00:00.000Z",
  proposedEndAt: "2026-12-02T10:00:00.000Z",
  assignedCoordinatorId,
  status: "APPROVED",
});

const line = (changes: Record<string, unknown> = {}) => ({
  id: "a1000000-0000-4000-8000-000000000001",
  eventId: EVENT_ID,
  eventReference: "EVT-000123",
  equipmentTypeId: CHAIRS,
  equipmentTypeName: "Folding Chairs",
  quantity: 40,
  notes: "Rows of 10",
  requiredFrom: "2026-12-02T06:00:00.000Z",
  requiredTo: "2026-12-02T10:00:00.000Z",
  status: "SUBMITTED",
  requestedBy: COORDINATOR,
  requestedAt: "2026-10-10T01:00:00.000Z",
  statusChangedBy: null,
  statusChangedAt: null,
  unavailableReason: null,
  substituteEquipmentTypeId: null,
  substituteEquipmentTypeName: null,
  substituteQuantity: null,
  reservation: null as null | Record<string, unknown>,
  updatedAt: "2026-10-10T01:00:00.000Z",
  ...changes,
});

const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const refusal = (code: string, message: string, status: number, fields?: { field: string; message: string }[]) =>
  reply({ error: { code, message, fields, correlationId: "corr-1" } }, status);

let assigned: string | null;
let lines: ReturnType<typeof line>[];
let onSave: (body: { eventId: string; lines: Record<string, unknown>[] }) => Response;
let onUpdate: (id: string, body: Record<string, unknown>) => Response;
let onRemove: (id: string) => Response;

const fetchMock = vi.fn(async (path: string, init?: RequestInit) => {
  const url = new URL(path, "http://app.test");
  const method = init?.method ?? "GET";
  const body = init?.body ? JSON.parse(init.body as string) : undefined;
  if (url.pathname === "/equipment/api/v1/equipment/types") {
    return reply({ items: [{ id: CHAIRS, name: "Folding Chairs", description: "", kind: "BULK", totalQuantity: 50 }, { id: PROJECTORS, name: "Projectors", description: "", kind: "BULK", totalQuantity: 5 }], nextCursor: null });
  }
  if (url.pathname === "/equipment/api/v1/equipment/request-lines" && method === "GET") return reply({ items: lines, nextCursor: null, event: event(assigned) });
  if (url.pathname === "/equipment/api/v1/equipment/request-lines" && method === "POST") return onSave(body);
  const removal = url.pathname.match(/request-lines\/([^/]+)\/removal$/);
  if (removal && method === "POST") return onRemove(removal[1]!);
  const edit = url.pathname.match(/request-lines\/([^/]+)$/);
  if (edit && method === "PUT") return onUpdate(edit[1]!, body);
  if (url.pathname.startsWith("/identity/api/v1/users")) return reply({ items: [{ id: COORDINATOR, displayName: "Coordinator One", email: "c1@example.test" }, { id: "74000000-0000-4000-8000-000000000004", displayName: "Tech Support One", email: "ts@example.test" }] });
  if (url.pathname.includes("/notifications")) return reply({ items: [], unreadCount: 0, nextCursor: null });
  throw new Error(`Unexpected request ${method} ${path}`);
});

function signIn(userId = COORDINATOR, hash = `#/events/${EVENT_ID}/equipment`) {
  sessionStorage.setItem(
    "connectsphere.session",
    JSON.stringify({ userId, email: "c1@example.test", role: "EVENT_COORDINATOR", token: "o1-token", lastLoginAt: "2026-10-10T00:00:00.000Z" }),
  );
  window.location.hash = hash;
}

const writeCalls = () => fetchMock.mock.calls.filter(([, init]) => init?.method && init.method !== "GET");

function setField(label: string, value: string, index = 0) {
  fireEvent.change(screen.getAllByLabelText(label, { exact: true })[index]!, { target: { value } });
}

beforeEach(() => {
  assigned = COORDINATOR;
  lines = [];
  onSave = (body) => reply({ items: body.lines.map((entry, index) => line({ id: `new-${index}`, ...entry })) }, 201);
  onUpdate = (id, body) => reply(line({ id, ...body }));
  onRemove = (id) => reply(line({ id, status: "REMOVED" }));
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  signIn();
});
afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

describe("O1 equipment request screen", () => {
  it("reads the event with the lines and never opens it for review, which would claim a Submitted event (D1)", async () => {
    render(<App />);
    await screen.findByText("Add equipment");
    const paths = fetchMock.mock.calls.map(([path]) => String(path));
    expect(paths.some((path) => path.startsWith("/event/api/v1/events/"))).toBe(false);
    expect(paths.some((path) => path.includes(`request-lines?eventId=${EVENT_ID}`))).toBe(true);
  });

  it("starts a line with the event's start and end, which the coordinator can still change", async () => {
    render(<App />);
    await screen.findByText("Add equipment");
    const from = screen.getByLabelText("Required from (local time)") as HTMLInputElement;
    const to = screen.getByLabelText("Required to (local time)") as HTMLInputElement;
    expect(new Date(from.value).toISOString()).toBe("2026-12-02T06:00:00.000Z");
    expect(new Date(to.value).toISOString()).toBe("2026-12-02T10:00:00.000Z");
    fireEvent.change(from, { target: { value: "2026-12-02T13:30" } });
    expect(from.value).toBe("2026-12-02T13:30");
  });

  it("saves a line with its type, quantity, notes and times, and says it is Submitted for Technical Support", async () => {
    render(<App />);
    await screen.findByText("Add equipment");
    setField("Equipment type", CHAIRS);
    setField("Quantity", "40");
    setField("Technical requirements / notes", "Set out in rows of 10");
    setField("Required from (local time)", "2026-12-02T13:00");
    fireEvent.click(screen.getByRole("button", { name: "Save request" }));

    expect(await screen.findByText("1 line saved")).toBeTruthy();
    expect(screen.getByText(/visible to Technical Support Staff/)).toBeTruthy();
    const [path, init] = fetchMock.mock.calls.find(([, call]) => call?.method === "POST")!;
    expect(path).toBe("/equipment/api/v1/equipment/request-lines");
    expect(init?.headers).toMatchObject({ Authorization: "Bearer o1-token" });
    expect(JSON.parse(init!.body as string)).toEqual({
      eventId: EVENT_ID,
      lines: [
        {
          equipmentTypeId: CHAIRS,
          quantity: 40,
          notes: "Set out in rows of 10",
          requiredFrom: new Date("2026-12-02T13:00").toISOString(),
          requiredTo: "2026-12-02T10:00:00.000Z",
        },
      ],
    });
  });

  it("saves several lines in one request", async () => {
    render(<App />);
    await screen.findByText("Add equipment");
    setField("Equipment type", CHAIRS);
    setField("Quantity", "40");
    fireEvent.click(screen.getByRole("button", { name: "Add another line" }));
    setField("Equipment type", PROJECTORS, 1);
    setField("Quantity", "2", 1);
    fireEvent.click(screen.getByRole("button", { name: "Save request" }));

    expect(await screen.findByText("2 lines saved")).toBeTruthy();
    const posts = fetchMock.mock.calls.filter(([, init]) => init?.method === "POST");
    expect(posts).toHaveLength(1);
    expect(JSON.parse(posts[0]![1]!.body as string).lines.map((entry: { equipmentTypeId: string }) => entry.equipmentTypeId)).toEqual([CHAIRS, PROJECTORS]);
  });

  it("can discard a second line before saving", async () => {
    render(<App />);
    await screen.findByText("Add equipment");
    expect(screen.queryByRole("button", { name: /Discard line/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Add another line" }));
    expect(screen.getAllByLabelText("Quantity")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Discard line 2" }));
    expect(screen.getAllByLabelText("Quantity")).toHaveLength(1);
  });

  it("shows the refusal beside the field, keeps what was typed, and lists no line", async () => {
    onSave = () =>
      refusal("VALIDATION_FAILED", "The equipment request could not be saved. Check the highlighted fields.", 400, [
        { field: "lines.0.quantity", message: "Quantity must be a whole number greater than zero." },
      ]);
    render(<App />);
    await screen.findByText("Add equipment");
    setField("Equipment type", CHAIRS);
    setField("Quantity", "0");
    setField("Technical requirements / notes", "kept");
    fireEvent.click(screen.getByRole("button", { name: "Save request" }));

    expect(await screen.findByText("The equipment request could not be saved. Check the highlighted fields.")).toBeTruthy();
    const quantity = screen.getByLabelText("Quantity") as HTMLInputElement;
    expect(quantity.getAttribute("aria-invalid")).toBe("true");
    expect(document.getElementById(quantity.getAttribute("aria-describedby")!)?.textContent).toBe(
      "Quantity must be a whole number greater than zero.",
    );
    expect(quantity.value).toBe("0");
    expect((screen.getByLabelText("Technical requirements / notes") as HTMLTextAreaElement).value).toBe("kept");
    expect(screen.queryByText("1 line saved")).toBeNull();
    expect(screen.getByText("No equipment has been requested for this event yet.")).toBeTruthy();
  });

  it("sends a non-numeric quantity on to the server to refuse, rather than inventing a number", async () => {
    onSave = () => refusal("VALIDATION_FAILED", "Refused.", 400, [{ field: "lines.0.quantity", message: "Quantity must be a whole number greater than zero." }]);
    render(<App />);
    await screen.findByText("Add equipment");
    setField("Equipment type", CHAIRS);
    setField("Quantity", "1.5");
    fireEvent.click(screen.getByRole("button", { name: "Save request" }));
    await screen.findByText("Refused.");
    const posts = fetchMock.mock.calls.filter(([, init]) => init?.method === "POST");
    expect(JSON.parse(posts[0]![1]!.body as string).lines[0].quantity).toBe(1.5);
  });

  it("lists the recorded lines with status, reason, substitute and who recorded them", async () => {
    lines = [
      line({ id: "l1" }),
      line({ id: "l2", equipmentTypeName: "Projectors", status: "UNAVAILABLE", unavailableReason: "All out that week" }),
      line({ id: "l3", equipmentTypeName: "Microphones", status: "SUBSTITUTED", substituteEquipmentTypeName: "Headsets", substituteQuantity: 3 }),
    ];
    render(<App />);
    expect((await screen.findAllByText("Rows of 10")).length).toBe(3);
    expect(screen.getByText("Reason: All out that week")).toBeTruthy();
    expect(screen.getByText("Instead: Headsets × 3")).toBeTruthy();
    expect(screen.getAllByText("Submitted").length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.getAllByText(/Coordinator One/).length).toBeGreaterThan(0));
  });

  it("shows a Reserved line as Reserved n of m", async () => {
    lines = [line({ id: "l1", status: "RESERVED", reservation: { id: "r1", equipmentTypeId: CHAIRS, requestedQuantity: 40, reservedQuantity: 30, reservedBy: "74000000-0000-4000-8000-000000000004", reservedAt: "2026-10-15T02:00:00.000Z" } })];
    render(<App />);
    expect(await screen.findByText(/Reserved 30 of 40/)).toBeTruthy();
    await waitFor(() => expect(screen.getByText(/Tech Support One/)).toBeTruthy());
  });

  it("edits a Submitted line and sends the whole line", async () => {
    lines = [line({ id: "l1" })];
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    expect(screen.getByText("Edit line")).toBeTruthy();
    setField("Quantity", "45", 0);
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(screen.queryByText("Edit line")).toBeNull());
    const [path, init] = fetchMock.mock.calls.find(([, call]) => call?.method === "PUT")!;
    expect(path).toBe("/equipment/api/v1/equipment/request-lines/l1");
    expect(JSON.parse(init!.body as string)).toMatchObject({ equipmentTypeId: CHAIRS, quantity: 45, notes: "Rows of 10" });
  });

  it("keeps the edit open and shows the server's refusal when an edit is refused", async () => {
    lines = [line({ id: "l1" })];
    onUpdate = () => refusal("EQUIPMENT_LINE_NOT_EDITABLE", "This line is Reserved. Only Submitted or Under Review lines can be edited or removed.", 409);
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText(/This line is Reserved/)).toBeTruthy();
    expect(screen.getByText("Edit line")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText("Edit line")).toBeNull();
  });

  it("asks before removing, then removes the line", async () => {
    lines = [line({ id: "l1" })];
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Remove" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Folding Chairs × 40 will be marked Removed/)).toBeTruthy();
    expect(writeCalls()).toHaveLength(0);

    lines = [];
    fireEvent.click(within(dialog).getByRole("button", { name: "Remove line" }));
    await waitFor(() => expect(writeCalls()).toHaveLength(1));
    expect(writeCalls()[0]![0]).toBe("/equipment/api/v1/equipment/request-lines/l1/removal");
    expect(await screen.findByText("No equipment has been requested for this event yet.")).toBeTruthy();
  });

  it("does not remove a line when the coordinator cancels", async () => {
    lines = [line({ id: "l1" })];
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Remove" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(writeCalls()).toHaveLength(0);
    expect(screen.getByText("Rows of 10")).toBeTruthy();
  });

  it("shows the server's refusal in the dialog when a removal is refused", async () => {
    lines = [line({ id: "l1" })];
    onRemove = () => refusal("EQUIPMENT_LINE_NOT_EDITABLE", "This line is Reserved.", 409);
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Remove" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Remove line" }));
    expect(await within(dialog).findByText("This line is Reserved.")).toBeTruthy();
  });

  it("offers no edit or removal for lines that are past Under Review", async () => {
    lines = [line({ id: "l1", status: "RESERVED" }), line({ id: "l2", status: "CONFIRMED" })];
    render(<App />);
    await screen.findAllByText("Cannot be changed here");
    expect(screen.getAllByText("Cannot be changed here")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Remove" })).toBeNull();
  });

  it("shows a coordinator who is not assigned the request but offers no way to change it", async () => {
    assigned = OTHER_COORDINATOR;
    lines = [line({ id: "l1" })];
    render(<App />);
    expect(await screen.findByText("You are not this event's coordinator")).toBeTruthy();
    expect(screen.getByText("Rows of 10")).toBeTruthy();
    expect(screen.queryByText("Add equipment")).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Save request" })).toBeNull();
  });

  it("says so when the event has no assigned coordinator yet", async () => {
    assigned = null;
    render(<App />);
    expect(await screen.findByText(/the assigned coordinator can record or/)).toBeTruthy();
  });

  it("renders the server's refusal when the request cannot be loaded", async () => {
    fetchMock.mockImplementationOnce(async () => refusal("EVENT_NOT_FOUND", "No event with that id exists.", 404));
    render(<App />);
    expect(await screen.findByText("No event with that id exists.")).toBeTruthy();
  });

  it("is closed to other roles", async () => {
    window.location.hash = `#/events/${EVENT_ID}/equipment`;
    sessionStorage.setItem(
      "connectsphere.session",
      JSON.stringify({ userId: "t", email: "t@example.test", role: "TECH_SUPPORT_STAFF", token: "t", lastLoginAt: "2026-10-10T00:00:00.000Z" }),
    );
    render(<App />);
    await waitFor(() => expect(window.location.hash).toBe("#/equipment"));
    expect(screen.queryByText("Add equipment")).toBeNull();
  });
});
