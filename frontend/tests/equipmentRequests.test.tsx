import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { App } from "../src/App.js";

// O2: Technical Support's equipment requests screen, through the real fetch client. Only the HTTP boundary is stubbed.
const TECH = "74000000-0000-4000-8000-000000000004";
const CHAIRS = "70000000-0000-4000-8000-000000000001";
const PROJECTORS = "70000000-0000-4000-8000-000000000002";

const line = (changes: Record<string, unknown> = {}) => ({
  id: "a1000000-0000-4000-8000-000000000001",
  eventId: "e1000000-0000-4000-8000-000000000001",
  eventReference: "EVT-000123",
  equipmentTypeId: CHAIRS,
  equipmentTypeName: "Folding Chairs",
  quantity: 40,
  notes: "Rows of 10",
  requiredFrom: "2026-12-02T06:00:00.000Z",
  requiredTo: "2026-12-02T10:00:00.000Z",
  status: "SUBMITTED",
  requestedBy: "c1000000-0000-4000-8000-000000000001",
  requestedAt: "2026-10-10T01:00:00.000Z",
  statusChangedBy: null,
  statusChangedAt: null,
  unavailableReason: null,
  substituteEquipmentTypeId: null,
  substituteEquipmentTypeName: null,
  substituteQuantity: null,
  updatedAt: "2026-10-10T01:00:00.000Z",
  ...changes,
});

const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

let lines: ReturnType<typeof line>[];
let onChange: (id: string, body: Record<string, unknown>) => Response;
let listCalls: URL[];

const fetchMock = vi.fn(async (path: string, init?: RequestInit) => {
  const url = new URL(path, "http://app.test");
  const method = init?.method ?? "GET";
  const statusRoute = url.pathname.match(/request-lines\/([^/]+)\/status$/);
  if (statusRoute && method === "POST") return onChange(statusRoute[1]!, JSON.parse(init!.body as string));
  if (url.pathname === "/equipment/api/v1/equipment/request-lines" && method === "GET") {
    listCalls.push(url);
    const status = url.searchParams.get("status");
    return reply({ items: status ? lines.filter((entry) => entry.status === status) : lines, nextCursor: null });
  }
  if (url.pathname === "/equipment/api/v1/equipment/types") {
    return reply({ items: [{ id: CHAIRS, name: "Folding Chairs", description: "", kind: "BULK", totalQuantity: 50 }, { id: PROJECTORS, name: "Projectors", description: "", kind: "BULK", totalQuantity: 5 }], nextCursor: null });
  }
  if (url.pathname.startsWith("/identity/api/v1/users")) return reply({ items: [{ id: TECH, displayName: "Tech Support One", email: "ts@example.test" }] });
  if (url.pathname.includes("/notifications")) return reply({ items: [], unreadCount: 0, nextCursor: null });
  throw new Error(`Unexpected request ${method} ${path}`);
});

function signIn(role = "TECH_SUPPORT_STAFF", hash = "#/equipment/requests") {
  sessionStorage.setItem(
    "connectsphere.session",
    JSON.stringify({ userId: TECH, email: "ts@example.test", role, token: "o2-token", lastLoginAt: "2026-10-10T00:00:00.000Z" }),
  );
  window.location.hash = hash;
}

const statusPosts = () => fetchMock.mock.calls.filter(([path, init]) => init?.method === "POST" && String(path).endsWith("/status"));

beforeEach(() => {
  lines = [line({ id: "l1" }), line({ id: "l2", equipmentTypeName: "Projectors", quantity: 2, eventReference: "EVT-000124", status: "UNDER_REVIEW" })];
  listCalls = [];
  onChange = (id, body) => reply(line({ id, ...body, status: body.status }));
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  signIn();
});
afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

describe("O2 equipment requests screen", () => {
  it("lists every event's lines with its reference, quantity and status", async () => {
    render(<App />);
    expect(await screen.findByText("EVT-000123")).toBeTruthy();
    expect(screen.getByText("EVT-000124")).toBeTruthy();
    expect(screen.getByText("Folding Chairs")).toBeTruthy();
    expect(screen.getAllByText("Submitted").length).toBeGreaterThan(1);
    expect(listCalls[0]!.searchParams.has("eventId")).toBe(false);
  });

  it("is in Technical Support's navigation and is the only role's route", async () => {
    signIn("TECH_SUPPORT_STAFF", "#/");
    render(<App />);
    fireEvent.click(await screen.findByRole("link", { name: "Equipment requests" }));
    expect(await screen.findByRole("heading", { name: "Equipment requests" })).toBeTruthy();
    cleanup();
    signIn("EVENT_COORDINATOR", "#/equipment/requests");
    render(<App />);
    await waitFor(() => expect(window.location.hash).toBe("#/queue"));
    expect(screen.queryByRole("link", { name: "Equipment requests" })).toBeNull();
  });

  it("asks the server for one status when filtered", async () => {
    render(<App />);
    await screen.findByText("EVT-000123");
    fireEvent.change(screen.getByLabelText("Show"), { target: { value: "UNDER_REVIEW" } });
    await waitFor(() => expect(screen.queryByText("EVT-000123")).toBeNull());
    expect(listCalls[listCalls.length - 1]!.searchParams.get("status")).toBe("UNDER_REVIEW");
    expect(screen.getByText("EVT-000124")).toBeTruthy();
  });

  it("sets a line Under Review with just the status", async () => {
    render(<App />);
    fireEvent.click((await screen.findAllByRole("button", { name: "Update" }))[0]!);
    expect(screen.getByRole("heading", { name: /Update Folding Chairs × 40 for EVT-000123/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save status" }));

    expect(await screen.findByText("Folding Chairs for EVT-000123 is now Under Review.")).toBeTruthy();
    const [path, init] = statusPosts()[0]!;
    expect(path).toBe("/equipment/api/v1/equipment/request-lines/l1/status");
    expect(JSON.parse(init!.body as string)).toEqual({ status: "UNDER_REVIEW" });
    expect(init?.headers).toMatchObject({ Authorization: "Bearer o2-token" });
  });

  it("confirms a line", async () => {
    render(<App />);
    fireEvent.click((await screen.findAllByRole("button", { name: "Update" }))[0]!);
    fireEvent.change(screen.getByLabelText("New status"), { target: { value: "CONFIRMED" } });
    fireEvent.click(screen.getByRole("button", { name: "Save status" }));
    await screen.findByText("Status updated");
    expect(JSON.parse(statusPosts()[0]![1]!.body as string)).toEqual({ status: "CONFIRMED" });
  });

  it("shows the refusal and leaves the line as it was when Unavailable has no reason, then saves with one", async () => {
    onChange = (_id, body) =>
      body.reason
        ? reply(line({ status: "UNAVAILABLE", unavailableReason: body.reason }))
        : reply({ error: { code: "VALIDATION_FAILED", message: "The status could not be changed. Check the highlighted fields.", fields: [{ field: "reason", message: "Give a reason why the equipment is unavailable." }], correlationId: null } }, 400);
    render(<App />);
    fireEvent.click((await screen.findAllByRole("button", { name: "Update" }))[0]!);
    fireEvent.change(screen.getByLabelText("New status"), { target: { value: "UNAVAILABLE" } });
    fireEvent.click(screen.getByRole("button", { name: "Save status" }));

    expect(await screen.findByText("The status could not be changed. Check the highlighted fields.")).toBeTruthy();
    expect(screen.getByText("Give a reason why the equipment is unavailable.")).toBeTruthy();
    expect(screen.queryByText("Status updated")).toBeNull();
    expect(screen.getAllByText("Submitted").length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "All chairs are out that week" } });
    fireEvent.click(screen.getByRole("button", { name: "Save status" }));
    await screen.findByText("Status updated");
    expect(JSON.parse(statusPosts()[1]![1]!.body as string)).toEqual({ status: "UNAVAILABLE", reason: "All chairs are out that week" });
  });

  it("asks for the substitute and sends its type and quantity", async () => {
    render(<App />);
    fireEvent.click((await screen.findAllByRole("button", { name: "Update" }))[0]!);
    fireEvent.change(screen.getByLabelText("New status"), { target: { value: "SUBSTITUTED" } });
    fireEvent.change(screen.getByLabelText("Substitute equipment"), { target: { value: PROJECTORS } });
    fireEvent.change(screen.getByLabelText("Substitute quantity"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Save status" }));

    await screen.findByText("Status updated");
    expect(JSON.parse(statusPosts()[0]![1]!.body as string)).toEqual({
      status: "SUBSTITUTED",
      substituteEquipmentTypeId: PROJECTORS,
      substituteQuantity: 3,
    });
  });

  it("sends an invalid substitute quantity on for the server to refuse", async () => {
    onChange = () => reply({ error: { code: "VALIDATION_FAILED", message: "Check the substitute.", fields: [{ field: "substituteQuantity", message: "Substitute quantity must be a whole number greater than zero." }], correlationId: null } }, 400);
    render(<App />);
    fireEvent.click((await screen.findAllByRole("button", { name: "Update" }))[0]!);
    fireEvent.change(screen.getByLabelText("New status"), { target: { value: "SUBSTITUTED" } });
    fireEvent.change(screen.getByLabelText("Substitute equipment"), { target: { value: PROJECTORS } });
    fireEvent.change(screen.getByLabelText("Substitute quantity"), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Save status" }));

    expect(await screen.findByText("Check the substitute.")).toBeTruthy();
    expect(JSON.parse(statusPosts()[0]![1]!.body as string).substituteQuantity).toBe(0);
    expect(screen.getByLabelText("Substitute quantity").getAttribute("aria-invalid")).toBe("true");
  });

  it("shows a line's reason or substitute and who changed it, and offers no update for a Reserved line", async () => {
    lines = [
      line({ id: "l1", status: "UNAVAILABLE", unavailableReason: "All out", statusChangedBy: TECH, statusChangedAt: "2026-10-10T02:00:00.000Z" }),
      line({ id: "l2", status: "SUBSTITUTED", substituteEquipmentTypeName: "Projectors", substituteQuantity: 3 }),
      line({ id: "l3", status: "RESERVED" }),
    ];
    render(<App />);
    expect(await screen.findByText("Reason: All out")).toBeTruthy();
    expect(screen.getByText("Instead: Projectors × 3")).toBeTruthy();
    await waitFor(() => expect(screen.getByText(/Tech Support One/)).toBeTruthy());
    expect(screen.getAllByRole("button", { name: "Update" })).toHaveLength(2);
    expect(screen.getAllByText("Reserved").length).toBeGreaterThan(1);
  });

  it("can cancel an update without sending anything", async () => {
    render(<App />);
    fireEvent.click((await screen.findAllByRole("button", { name: "Update" }))[0]!);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("button", { name: "Save status" })).toBeNull();
    expect(statusPosts()).toHaveLength(0);
  });

  it("explains an empty list", async () => {
    lines = [];
    render(<App />);
    expect(await screen.findByText("No equipment lines match.")).toBeTruthy();
  });

  it("shows the server's refusal when the lines cannot be loaded", async () => {
    fetchMock.mockImplementationOnce(async () => reply({ error: { code: "IDENTITY_UNAVAILABLE", message: "Your permissions could not be verified.", correlationId: null } }, 503));
    render(<App />);
    expect(await screen.findByText("Your permissions could not be verified.")).toBeTruthy();
  });
});
