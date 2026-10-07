import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { App } from "../src/App.js";

// P1 acceptance checks exercise the real API client; only the HTTP boundary is stubbed.
const items = [
  { id: "chairs", name: "Chairs", description: "Bulk seating", kind: "BULK", totalQuantity: 10 },
  { id: "projectors", name: "Projectors", description: "Tracked units", kind: "SERIALIZED", totalQuantity: 3 },
];
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
let availability: (url: URL) => Promise<Response>;
let catalogue = items;
const fetchMock = vi.fn(async (path: string, _options?: RequestInit) => {
  if (_options?.method !== "GET") throw new Error("P1 must only issue read requests.");
  const url = new URL(path, "http://app.test");
  if (url.pathname.endsWith("/availability")) return availability(url);
  if (url.pathname === "/equipment/api/v1/equipment/types") return response({ items: catalogue, nextCursor: null });
  if (url.pathname.includes("/notifications")) return response({ items: [], unreadCount: 0, nextCursor: null });
  if (url.pathname === "/event/api/v1/events") return response({ items: [], nextCursor: null });
  throw new Error(`Unexpected request ${path}`);
});

function session(role = "TECH_SUPPORT_STAFF", hash = "#/equipment/availability") {
  sessionStorage.setItem("connectsphere.session", JSON.stringify({ userId: "staff", email: "staff@example.test", role, token: "p1-token", lastLoginAt: "2026-10-08T00:00:00.000Z" }));
  window.location.hash = hash;
}
function type(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label, { exact: true }), { target: { value } });
}
async function fill(quantity = "7") {
  await screen.findByRole("option", { name: "Chairs" });
  type("Equipment type", "chairs");
  type("Requested quantity", quantity);
  type("Starts at (local time)", "2026-10-09T09:00");
  type("Ends at (local time)", "2026-10-09T11:00");
}
function result(availableQuantity: number, shortfallQuantity: number) {
  return { equipmentTypeId: "chairs", kind: "BULK", totalQuantity: 10, availableQuantity, shortfallQuantity, requestedQuantity: 7, startsAt: "2026-10-09T01:00:00.000Z", endsAt: "2026-10-09T03:00:00.000Z" };
}
beforeEach(() => {
  catalogue = items;
  availability = async () => response(result(6, 1));
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  session();
});
afterEach(() => { cleanup(); sessionStorage.clear(); vi.unstubAllGlobals(); });

describe("P1 equipment availability through the real fetch client", () => {
  it("lands Technical Support at availability and shows exact numeric availability and shortfall", async () => {
    session("TECH_SUPPORT_STAFF", "#/");
    render(<App />);
    await fill();
    expect(screen.getByRole("link", { name: "Equipment availability" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Check availability" }));
    expect(await screen.findByText("Available quantity: 6")).toBeTruthy();
    expect(screen.getByText("Shortfall quantity: 1")).toBeTruthy();
    const [path, options] = fetchMock.mock.calls.find(([path]) => path.includes("/availability?"))!;
    const url = new URL(path, "http://app.test");
    expect(url.searchParams.get("requestedQuantity")).toBe("7");
    expect(url.searchParams.get("startsAt")).toBe(new Date("2026-10-09T09:00").toISOString());
    expect(url.searchParams.get("endsAt")).toBe(new Date("2026-10-09T11:00").toISOString());
    // With TZ=Asia/Singapore this checks the application's UTC conversion explicitly.
    if (new Date("2026-10-09T09:00").getTimezoneOffset() === -480) {
      expect(url.searchParams.get("startsAt")).toBe("2026-10-09T01:00:00.000Z");
    }
    expect(options?.method).toBe("GET");
    expect(options?.headers).toMatchObject({ Authorization: "Bearer p1-token" });
    expect(fetchMock.mock.calls.every(([, init]) => init?.method === "GET")).toBe(true);
  });

  it.each([[0, 7], [6, 0]])("shows availability %s and shortfall %s including zero", async (available, shortfall) => {
    availability = async () => response(result(available, shortfall));
    render(<App />);
    await fill();
    fireEvent.click(screen.getByRole("button", { name: "Check availability" }));
    expect(await screen.findByText(`Available quantity: ${available}`)).toBeTruthy();
    expect(screen.getByText(`Shortfall quantity: ${shortfall}`)).toBeTruthy();
  });

  it.each([
    ["Equipment type", "projectors"], ["Requested quantity", "8"],
    ["Starts at (local time)", "2026-10-09T08:00"], ["Ends at (local time)", "2026-10-09T12:00"],
  ])("clears a previous answer when %s changes", async (label, value) => {
    render(<App />);
    await fill();
    fireEvent.click(screen.getByRole("button", { name: "Check availability" }));
    await screen.findByText("Available quantity: 6");
    type(label, value);
    expect(screen.queryByText("Available quantity: 6")).toBeNull();
  });

  it("does not resurrect an old response after the form changes during a request", async () => {
    let resolve!: (response: Response) => void;
    availability = () => new Promise<Response>((done) => { resolve = done; });
    render(<App />);
    await fill();
    fireEvent.click(screen.getByRole("button", { name: "Check availability" }));
    await waitFor(() => expect(resolve).toBeTruthy());
    type("Requested quantity", "8");
    availability = async () => response(result(5, 3));
    fireEvent.click(screen.getByRole("button", { name: "Check availability" }));
    await screen.findByText("Available quantity: 5");
    await act(async () => resolve(response(result(6, 1))));
    expect(screen.queryByText("Available quantity: 6")).toBeNull();
    expect(screen.getByText("Shortfall quantity: 3")).toBeTruthy();
  });

  it("renders a server refusal and associates the field error with its input", async () => {
    availability = async () => response({ error: { code: "VALIDATION_FAILED", message: "Check the requested window.", fields: [{ field: "endsAt", message: "End must be after start." }], correlationId: "p1-correlation" } }, 400);
    render(<App />);
    await fill();
    fireEvent.click(screen.getByRole("button", { name: "Check availability" }));
    expect(await screen.findByText("Check the requested window.")).toBeTruthy();
    const input = screen.getByLabelText("Ends at (local time)");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(document.getElementById(input.getAttribute("aria-describedby")!)?.textContent).toBe("End must be after start.");
    expect(screen.queryByText("Available quantity: 6")).toBeNull();
  });

  it("shows an empty catalogue and offers no check", async () => {
    catalogue = [];
    render(<App />);
    expect(await screen.findByText("No equipment types are recorded yet.")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Check availability" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("accepts a requested quantity of zero", async () => {
    availability = async (url) => {
      expect(url.searchParams.get("requestedQuantity")).toBe("0");
      return response({ ...result(6, 0), requestedQuantity: 0 });
    };
    render(<App />);
    await fill("0");
    fireEvent.click(screen.getByRole("button", { name: "Check availability" }));
    expect(await screen.findByText("Shortfall quantity: 0")).toBeTruthy();
  });

  it("refuses missing inputs locally and sends no availability request", async () => {
    render(<App />);
    await screen.findByRole("option", { name: "Chairs" });
    type("Requested quantity", "");
    fireEvent.click(screen.getByRole("button", { name: "Check availability" }));
    expect(await screen.findByText("Check the highlighted fields.")).toBeTruthy();
    for (const label of ["Equipment type", "Requested quantity", "Starts at (local time)", "Ends at (local time)"]) {
      expect(screen.getByLabelText(label, { exact: true }).getAttribute("aria-invalid")).toBe("true");
    }
    expect(fetchMock.mock.calls.some(([path]) => path.includes("/availability?"))).toBe(false);
  });

  it.each(["-1", "1.5", "9007199254740992"])("refuses invalid requested quantity %s", async (quantity) => {
    render(<App />);
    await fill(quantity);
    fireEvent.click(screen.getByRole("button", { name: "Check availability" }));
    expect(screen.getByLabelText("Requested quantity").getAttribute("aria-invalid")).toBe("true");
    expect(fetchMock.mock.calls.some(([path]) => path.includes("/availability?"))).toBe(false);
  });

  it("refuses reversed or equal time windows", async () => {
    render(<App />);
    await fill();
    type("Ends at (local time)", "2026-10-09T09:00");
    fireEvent.click(screen.getByRole("button", { name: "Check availability" }));
    expect(screen.getByLabelText("Ends at (local time)").getAttribute("aria-invalid")).toBe("true");
    type("Ends at (local time)", "2026-10-09T08:00");
    fireEvent.click(screen.getByRole("button", { name: "Check availability" }));
    expect(screen.getByLabelText("Ends at (local time)").getAttribute("aria-invalid")).toBe("true");
    expect(fetchMock.mock.calls.some(([path]) => path.includes("/availability?"))).toBe(false);
  });

  it("renders network errors without inventing an availability result", async () => {
    availability = async () => { throw new Error("Equipment service unreachable."); };
    render(<App />);
    await fill();
    fireEvent.click(screen.getByRole("button", { name: "Check availability" }));
    expect(await screen.findByText("Equipment service unreachable.")).toBeTruthy();
    expect(screen.queryByText("Available quantity: 6")).toBeNull();
  });

  it("ignores a stale refusal after another form has succeeded", async () => {
    let resolve!: (response: Response) => void;
    availability = () => new Promise<Response>((done) => { resolve = done; });
    render(<App />);
    await fill();
    fireEvent.click(screen.getByRole("button", { name: "Check availability" }));
    type("Requested quantity", "8");
    availability = async () => response(result(5, 3));
    fireEvent.click(screen.getByRole("button", { name: "Check availability" }));
    await screen.findByText("Available quantity: 5");
    await act(async () => resolve(response({ error: { code: "FORBIDDEN", message: "Stale refusal.", correlationId: null } }, 403)));
    expect(screen.queryByText("Stale refusal.")).toBeNull();
    expect(screen.getByText("Available quantity: 5")).toBeTruthy();
  });

  it("redirects an organiser and hides equipment availability navigation", async () => {
    session("EVENT_ORGANISER");
    render(<App />);
    await screen.findByRole("heading", { name: "My requests" });
    expect(screen.queryByRole("link", { name: "Equipment availability" })).toBeNull();
    expect(fetchMock.mock.calls.some(([path]) => path.startsWith("/equipment"))).toBe(false);
  });
});
