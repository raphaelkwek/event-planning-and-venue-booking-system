import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { App } from "../src/App.js";

// Independent UI checks from P2 AC1/AC2 and the functional card inputs.
// The real API client runs; only HTTP responses are stubbed. Database outcomes
// are checked separately by equipment/api/inventory.test.ts on CI's Postgres.
const endpoint = "/equipment/api/v1/equipment/types";
const record = {
  id: "10000000-0000-4000-8000-000000000001",
  name: "P2 Wireless Microphone",
  description: "Handheld wireless microphone for talks and panels.",
  characteristics: { "Frequency band": "534–598 MHz", Connector: "XLR", Power: "2×AA" },
  kind: "BULK",
  totalQuantity: 20,
  unitLabels: [], units: [], unavailability: [], history: [],
};
const fetchMock = vi.fn<typeof fetch>();
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json" },
});

beforeEach(() => {
  sessionStorage.setItem("connectsphere.session", JSON.stringify({
    userId: "tech-id", email: "techsupport@connectsphere.test", role: "TECH_SUPPORT_STAFF",
    token: "card-test-token", lastLoginAt: "2026-10-08T00:00:00Z",
  }));
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});
afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

function change(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

describe("P2 functional card UI checks with the real HTTP client", () => {
  it.each([
    ["P2-T1", "P2 Wireless Microphone", record.description, "Frequency band: 534–598 MHz\nConnector: XLR\nPower: 2×AA", 20],
    ["P2-T2", "P2 Spare Audio Mixer", "Inventory type created before stock arrives.", "Inputs: 12", 0],
    ["P2-T3", "P2 Negative Quantity", "Boundary test record", "Category: Test", -1],
  ])("%s sends every inventory attribute and retains refused inputs", async (_card, name, description, characteristics, totalQuantity) => {
    const expectedCharacteristics = totalQuantity === 20 ? record.characteristics
      : totalQuantity === 0 ? { Inputs: "12" } : { Category: "Test" };
    const saved = { ...record, name, description, characteristics: expectedCharacteristics, totalQuantity };
    fetchMock.mockImplementation(async (url, options) => {
      if (String(url).startsWith("/notification/")) return json({ items: [], unreadCount: 0 });
      if (url === endpoint && options?.method === "POST") {
        return totalQuantity < 0 ? json({ error: {
          code: "VALIDATION_FAILED", message: "Check the highlighted fields.", correlationId: null,
          fields: [{ field: "totalQuantity", message: "Total quantity must be a whole number of zero or greater." }],
        } }, 400) : json(saved, 201);
      }
      if (url === `${endpoint}/${record.id}`) return json(saved);
      if (url === endpoint) return json({ items: [saved], nextCursor: null });
      throw new Error(`Unexpected request: ${String(url)}`);
    });
    window.location.hash = "#/equipment/new";
    render(<App />);
    await screen.findByRole("heading", { name: "New equipment type" });
    change("Name", name);
    change("Description", description);
    change("Technical characteristics (name: value, one per line)", characteristics);
    change("Total quantity held", String(totalQuantity));
    fireEvent.click(screen.getByRole("button", { name: "Save equipment type" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(endpoint, expect.objectContaining({
      method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer card-test-token" },
      body: JSON.stringify({ name, description, characteristics: expectedCharacteristics, kind: "BULK", totalQuantity, unitLabels: [] }),
    })));
    if (totalQuantity < 0) {
      await screen.findAllByText("Total quantity must be a whole number of zero or greater.");
      expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe(name);
      expect((screen.getByLabelText("Total quantity held") as HTMLInputElement).value).toBe("-1");
    } else {
      await screen.findByText("Equipment type saved.");
      fireEvent.click(screen.getByRole("button", { name: "Back to inventory" }));
      fireEvent.click(await screen.findByRole("link", { name: "Maintain" }));
      await waitFor(() => expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe(name));
      expect((screen.getByLabelText("Description") as HTMLTextAreaElement).value).toBe(description);
      expect((screen.getByLabelText("Technical characteristics (name: value, one per line)") as HTMLTextAreaElement).value).toBe(characteristics);
      expect((screen.getByLabelText("Total quantity held") as HTMLInputElement).value).toBe(String(totalQuantity));
    }
  });

  it.each([
    ["P2-T4", "Battery compartments under repair", "2026-12-10T09:00", "2026-12-10T09:01", null],
    ["P2-T5", "", "2026-12-10T09:00", "2026-12-12T17:00", "reason"],
    ["P2-T6", "   ", "2026-12-10T09:00", "2026-12-12T17:00", "reason"],
    ["P2-T7", "Battery compartments under repair", "2026-12-10T09:00", "2026-12-10T09:00", "endsAt"],
    ["P2-T8", "Battery compartments under repair", "2026-12-10T17:00", "2026-12-10T09:00", "endsAt"],
  ])("%s sends the entered period and renders the outcome", async (_card, reason, startsAt, endsAt, field) => {
    const message = field === "reason" ? "Enter why the equipment is unavailable."
      : "The end of the unavailable period must be later than the start.";
    const unavailable = { id: "unavailability-id", quantity: 2, reason, status: "ACTIVE",
      startsAt: new Date(startsAt).toISOString(), endsAt: new Date(endsAt).toISOString() };
    let recorded = false;
    fetchMock.mockImplementation(async (url, options) => {
      if (String(url).startsWith("/notification/")) return json({ items: [], unreadCount: 0 });
      if (url === `${endpoint}/${record.id}/unavailability` && options?.method === "POST") {
        if (field) return json({ error: { code: "VALIDATION_FAILED", message,
          fields: [{ field, message }], correlationId: null } }, 400);
        recorded = true;
        return json(unavailable, 201);
      }
      if (url === `${endpoint}/${record.id}`) return json({ ...record, unavailability: recorded ? [unavailable] : [] });
      throw new Error(`Unexpected request: ${String(url)}`);
    });
    window.location.hash = `#/equipment/${record.id}/edit`;
    render(<App />);
    await screen.findByRole("heading", { name: "Maintain equipment type" });
    change("Quantity", "2");
    change("Unavailable from", startsAt);
    change("Unavailable until", endsAt);
    change("Reason", reason);
    fireEvent.click(screen.getByRole("button", { name: "Mark unavailable" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(`${endpoint}/${record.id}/unavailability`, expect.objectContaining({
      method: "POST", body: JSON.stringify({ unitId: null, quantity: 2,
        startsAt: unavailable.startsAt, endsAt: unavailable.endsAt, reason }),
    })));
    if (field) {
      await screen.findAllByText(message);
      expect(screen.getByText("No out-of-service periods are recorded.")).toBeTruthy();
      expect((screen.getByLabelText("Reason") as HTMLTextAreaElement).value).toBe(reason);
    } else {
      await screen.findByText("Unavailability recorded.");
      expect(screen.getByText(/2 units · .*Battery compartments under repair \(active\)/)).toBeTruthy();
    }
    expect((screen.getByLabelText("Total quantity held") as HTMLInputElement).value).toBe("20");
  });
});
