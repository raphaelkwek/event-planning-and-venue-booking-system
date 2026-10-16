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
  reservation: null as null | Record<string, unknown>,
  updatedAt: "2026-10-10T01:00:00.000Z",
  ...changes,
});

const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

let lines: ReturnType<typeof line>[];
let onChange: (id: string, body: Record<string, unknown>) => Response;
let onReserve: (id: string, body: Record<string, unknown>) => Response;
let onRelease: (id: string, body: Record<string, unknown>) => Response;
let listCalls: URL[];

const fetchMock = vi.fn(async (path: string, init?: RequestInit) => {
  const url = new URL(path, "http://app.test");
  const method = init?.method ?? "GET";
  const releaseRoute = url.pathname.match(/request-lines\/([^/]+)\/release$/);
  if (releaseRoute && method === "POST") return onRelease(releaseRoute[1]!, JSON.parse(init!.body as string));
  const reserveRoute = url.pathname.match(/request-lines\/([^/]+)\/reservation$/);
  if (reserveRoute && method === "POST") return onReserve(reserveRoute[1]!, JSON.parse(init!.body as string));
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
  onReserve = (id, body) => {
    const reservation = { id: "r1", equipmentTypeId: CHAIRS, equipmentTypeName: "Folding Chairs", requestedQuantity: 40, reservedQuantity: body.quantity ?? 40, reservedBy: TECH, reservedAt: "2026-10-15T02:00:00.000Z" };
    return reply({ reservation, line: line({ id, status: "RESERVED", reservation }) }, 201);
  };
  onRelease = (id) => reply({ reservation: { id: "r1", status: "RELEASED" }, line: line({ id, status: "CONFIRMED" }) });
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
    fireEvent.click((await screen.findAllByRole("button", { name: /^Update .+ for EVT-\d+$/ }))[0]!);
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
    fireEvent.click((await screen.findAllByRole("button", { name: /^Update .+ for EVT-\d+$/ }))[0]!);
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
    fireEvent.click((await screen.findAllByRole("button", { name: /^Update .+ for EVT-\d+$/ }))[0]!);
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
    fireEvent.click((await screen.findAllByRole("button", { name: /^Update .+ for EVT-\d+$/ }))[0]!);
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
    fireEvent.click((await screen.findAllByRole("button", { name: /^Update .+ for EVT-\d+$/ }))[0]!);
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
    expect(screen.getAllByRole("button", { name: /^Update .+ for EVT-\d+$/ })).toHaveLength(2);
    expect(screen.getAllByText("Reserved").length).toBeGreaterThan(1);
  });

  it("can cancel an update without sending anything", async () => {
    render(<App />);
    fireEvent.click((await screen.findAllByRole("button", { name: /^Update .+ for EVT-\d+$/ }))[0]!);
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

describe("Q1: reserving from the equipment requests screen", () => {
  it("offers Reserve only on Confirmed and Substituted lines", async () => {
    lines = [line({ id: "c", status: "CONFIRMED" }), line({ id: "s", status: "SUBSTITUTED", substituteEquipmentTypeName: "Projectors", substituteQuantity: 2 }), line({ id: "u", status: "UNDER_REVIEW" })];
    render(<App />);
    await screen.findAllByText("EVT-000123");
    expect(screen.getAllByRole("button", { name: /^Reserve .+ for EVT-\d+$/ })).toHaveLength(2);
  });

  it("asks for confirmation before a partial reservation, then shows Reserved n of m", async () => {
    lines = [line({ id: "c", status: "CONFIRMED" })];
    const reserved = { id: "r1", equipmentTypeId: CHAIRS, equipmentTypeName: "Folding Chairs", requestedQuantity: 40, reservedQuantity: 30, reservedBy: TECH, reservedAt: "2026-10-15T02:00:00.000Z" };
    onReserve = (id, body) =>
      body.partial
        ? reply({ reservation: { id: "r1", reservedQuantity: 30, requestedQuantity: 40 }, line: line({ id, status: "RESERVED", reservation: reserved }) }, 201)
        : reply({ error: { code: "PARTIAL_NOT_CONFIRMED", message: "40 were requested. Confirm a partial reservation to reserve 30.", correlationId: null } }, 409);
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: /^Reserve .+ for EVT-\d+$/ }));
    fireEvent.change(screen.getByLabelText("Quantity to reserve"), { target: { value: "30" } });
    fireEvent.click(screen.getByRole("button", { name: "Reserve equipment" }));
    expect(await screen.findByText(/Confirm a partial reservation to reserve 30/)).toBeTruthy();

    lines = [line({ id: "c", status: "RESERVED", statusChangedBy: TECH, statusChangedAt: "2026-10-15T02:00:00.000Z", reservation: reserved })];
    fireEvent.click(screen.getByLabelText("Reserve fewer than requested"));
    fireEvent.click(screen.getByRole("button", { name: "Reserve equipment" }));
    expect(await screen.findByText("Reserved 30 of 40")).toBeTruthy();
    await waitFor(() => expect(screen.getByText(/Tech Support One/)).toBeTruthy());
  });

  it("shows the shortfall when there is not enough stock, and the line stays Confirmed", async () => {
    lines = [line({ id: "c", status: "CONFIRMED" })];
    onReserve = () => reply({ error: { code: "INSUFFICIENT_EQUIPMENT", message: "Not enough available for this period: 40 requested, 35 available, 5 short.", details: { available: 35, shortfall: 5 }, correlationId: null } }, 409);
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: /^Reserve .+ for EVT-\d+$/ }));
    fireEvent.click(screen.getByRole("button", { name: "Reserve equipment" }));
    expect(await screen.findByText(/5 short/)).toBeTruthy();
    expect(screen.getAllByText("Confirmed").length).toBeGreaterThan(0);
  });
  it("sends no quantity when the box is emptied, so the server reserves the requested quantity", async () => {
    lines = [line({ id: "c", status: "CONFIRMED" })];
    const bodies: Record<string, unknown>[] = [];
    onReserve = (id, body) => {
      bodies.push(body);
      return reply({ reservation: { id: "r1", reservedQuantity: 40, requestedQuantity: 40 }, line: line({ id, status: "RESERVED" }) }, 201);
    };
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Reserve Folding Chairs for EVT-000123" }));
    fireEvent.change(screen.getByLabelText("Quantity to reserve"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Reserve equipment" }));
    expect(await screen.findByText("Equipment reserved")).toBeTruthy();
    expect(bodies).toEqual([{ partial: false }]);
  });

  it("shows the partial checkbox only while the quantity is between 1 and the requested one", async () => {
    lines = [line({ id: "c", status: "CONFIRMED" })];
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Reserve Folding Chairs for EVT-000123" }));
    const box = () => screen.queryByLabelText("Reserve fewer than requested");
    const quantity = screen.getByLabelText("Quantity to reserve");
    expect(box()).toBeNull();
    fireEvent.change(quantity, { target: { value: "30" } });
    expect(box()).not.toBeNull();
    for (const value of ["0", "", "40", "41"]) {
      fireEvent.change(quantity, { target: { value } });
      expect(box(), value).toBeNull();
    }
  });

  it("ties the quantity refusal to the box", async () => {
    lines = [line({ id: "c", status: "CONFIRMED" })];
    onReserve = () =>
      reply({ error: { code: "VALIDATION_FAILED", message: "The equipment could not be reserved.", fields: [{ field: "quantity", message: "You can reserve at most 40, the quantity requested." }], correlationId: null } }, 400);
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Reserve Folding Chairs for EVT-000123" }));
    fireEvent.change(screen.getByLabelText("Quantity to reserve"), { target: { value: "41" } });
    fireEvent.click(screen.getByRole("button", { name: "Reserve equipment" }));
    const message = await screen.findByText("You can reserve at most 40, the quantity requested.");
    expect(screen.getByLabelText("Quantity to reserve").getAttribute("aria-describedby")).toBe(message.id);
  });

  it("opens Reserve or Update one at a time", async () => {
    lines = [line({ id: "c", status: "CONFIRMED" })];
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Reserve Folding Chairs for EVT-000123" }));
    expect(screen.queryByRole("button", { name: "Reserve equipment" })).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Update Folding Chairs for EVT-000123" }));
    expect(screen.queryByRole("button", { name: "Reserve equipment" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Save status" })).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Reserve Folding Chairs for EVT-000123" }));
    expect(screen.queryByRole("button", { name: "Save status" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Reserve equipment" })).not.toBeNull();
  });

  it("names the substitute type on a Reserved row that was Substituted", async () => {
    lines = [
      line({
        id: "s",
        status: "RESERVED",
        reservation: { id: "r1", equipmentTypeId: PROJECTORS, equipmentTypeName: "Projectors", requestedQuantity: 3, reservedQuantity: 2, reservedBy: TECH, reservedAt: "2026-10-15T02:00:00.000Z" },
      }),
    ];
    render(<App />);
    expect(await screen.findByText("Reserved 2 of 3 Projectors")).toBeTruthy();
  });
});

describe("Q2: releasing from the equipment requests screen", () => {
  const reservation = { id: "r1", equipmentTypeId: CHAIRS, equipmentTypeName: "Folding Chairs", requestedQuantity: 40, reservedQuantity: 40, reservedBy: TECH, reservedAt: "2026-10-15T02:00:00.000Z" };
  const reserved = (id = "r") => line({ id, status: "RESERVED", reservation });
  const releasePosts = () => fetchMock.mock.calls.filter(([path, init]) => init?.method === "POST" && String(path).endsWith("/release"));

  it("offers Release on Reserved rows only, named for the reserved type", async () => {
    lines = [reserved("r"), line({ id: "c", status: "CONFIRMED" })];
    render(<App />);
    await screen.findAllByText("EVT-000123");
    expect(screen.getAllByRole("button", { name: /^Release .+ for EVT-\d+$/ })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Release Folding Chairs for EVT-000123" })).toBeTruthy();
  });

  it("names the substitute type on a Reserved row that was Substituted", async () => {
    lines = [line({ id: "s", status: "RESERVED", reservation: { ...reservation, equipmentTypeId: PROJECTORS, equipmentTypeName: "Projectors" } })];
    render(<App />);
    expect(await screen.findByRole("button", { name: "Release Projectors for EVT-000123" })).toBeTruthy();
  });

  it("shows the server's reason message inline and keeps the row Reserved", async () => {
    lines = [reserved()];
    onRelease = () =>
      reply({ error: { code: "VALIDATION_FAILED", message: "The reservation could not be released.", fields: [{ field: "reason", message: "Give a reason for releasing the reservation." }], correlationId: null } }, 400);
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Release Folding Chairs for EVT-000123" }));
    expect(screen.getByRole("heading", { name: /Release Folding Chairs × 40 for EVT-000123/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Release reservation" }));
    const message = await screen.findByText("Give a reason for releasing the reservation.");
    expect(document.getElementById("release-reason")!.getAttribute("aria-describedby")).toBe(message.id);
    expect(screen.getByRole("button", { name: "Release Folding Chairs for EVT-000123" })).toBeTruthy();
    expect(screen.queryByText("Equipment released")).toBeNull();
  });

  it("posts the reason, shows the banner, and the reloaded row is Confirmed with Reserve", async () => {
    lines = [reserved()];
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Release Folding Chairs for EVT-000123" }));
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Event moved" } });
    lines = [line({ id: "r", status: "CONFIRMED" })];
    fireEvent.click(screen.getByRole("button", { name: "Release reservation" }));

    expect(await screen.findByText("Equipment released")).toBeTruthy();
    expect(screen.getByText("Released Folding Chairs for EVT-000123: Event moved.")).toBeTruthy();
    const [path, init] = releasePosts()[0]!;
    expect(path).toBe("/equipment/api/v1/equipment/request-lines/r/release");
    expect(JSON.parse(init!.body as string)).toEqual({ reason: "Event moved" });
    expect(await screen.findByRole("button", { name: "Reserve Folding Chairs for EVT-000123" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Release reservation" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Release Folding Chairs for EVT-000123" })).toBeNull();
  });

  it("shows a refusal from the server, such as an already released reservation", async () => {
    lines = [reserved()];
    onRelease = () => reply({ error: { code: "RESERVATION_ALREADY_RELEASED", message: "This reservation has already been released.", correlationId: null } }, 409);
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Release Folding Chairs for EVT-000123" }));
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Event moved" } });
    fireEvent.click(screen.getByRole("button", { name: "Release reservation" }));
    expect(await screen.findByText("This reservation has already been released.")).toBeTruthy();
  });

  it("can cancel without sending anything", async () => {
    lines = [reserved()];
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Release Folding Chairs for EVT-000123" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("button", { name: "Release reservation" })).toBeNull();
    expect(releasePosts()).toHaveLength(0);
  });

  it("opens Update, Reserve and Release one at a time", async () => {
    lines = [line({ id: "c", status: "CONFIRMED" }), reserved("r")];
    render(<App />);
    const update = await screen.findByRole("button", { name: "Update Folding Chairs for EVT-000123" });
    const open = {
      update: () => fireEvent.click(update),
      reserve: () => fireEvent.click(screen.getByRole("button", { name: "Reserve Folding Chairs for EVT-000123" })),
      release: () => fireEvent.click(screen.getByRole("button", { name: "Release Folding Chairs for EVT-000123" })),
    };
    const shown = () => ({
      update: screen.queryByRole("button", { name: "Save status" }) !== null,
      reserve: screen.queryByRole("button", { name: "Reserve equipment" }) !== null,
      release: screen.queryByRole("button", { name: "Release reservation" }) !== null,
    });
    open.release();
    expect(shown()).toEqual({ update: false, reserve: false, release: true });
    open.reserve();
    expect(shown()).toEqual({ update: false, reserve: true, release: false });
    open.release();
    expect(shown()).toEqual({ update: false, reserve: false, release: true });
    open.update();
    expect(shown()).toEqual({ update: true, reserve: false, release: false });
    open.release();
    expect(shown()).toEqual({ update: false, reserve: false, release: true });
  });
});
