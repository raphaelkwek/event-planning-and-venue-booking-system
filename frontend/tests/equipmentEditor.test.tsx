import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ApiError } from "../src/api/client.js";

const TYPE_ID = "10000000-0000-4000-8000-000000000001";
const UNIT_ID = "20000000-0000-4000-8000-000000000001";

const bulkType = {
  id: TYPE_ID,
  name: "Folding chair",
  description: "Black folding chair",
  characteristics: { material: "steel" },
  kind: "BULK" as const,
  totalQuantity: 120,
  unitLabels: [],
  units: [],
  unavailability: [],
  history: [],
  createdAt: "2026-10-07T01:00:00.000Z",
  createdBy: "tech-id",
  updatedAt: "2026-10-07T01:00:00.000Z",
  updatedBy: "tech-id",
};

vi.mock("../src/api/equipment.js", async () => {
  const actual = await vi.importActual<typeof import("../src/api/equipment.js")>("../src/api/equipment.js");
  return {
    ...actual,
    listEquipmentTypes: vi.fn(async () => ({ items: [] })),
    getEquipmentType: vi.fn(async () => bulkType),
    createEquipmentType: vi.fn(async (_token, body) => ({ ...bulkType, ...body })),
    updateEquipmentType: vi.fn(async () => bulkType),
    addEquipmentUnavailability: vi.fn(async () => ({
      id: "unavailability-id",
      unitId: UNIT_ID,
      quantity: null,
      startsAt: "2026-12-01T01:00",
      endsAt: "2026-12-01T05:00",
      reason: "Lamp replacement",
      status: "ACTIVE",
      createdAt: "2026-10-07T01:00:00.000Z",
      createdBy: "tech-id",
      updatedAt: "2026-10-07T01:00:00.000Z",
      updatedBy: "tech-id",
    })),
  };
});

const { App } = await import("../src/App.js");
const equipmentApi = await import("../src/api/equipment.js");

function signIn(role = "TECH_SUPPORT_STAFF") {
  sessionStorage.setItem(
    "connectsphere.session",
    JSON.stringify({ userId: "tech-id", email: "tech@connectsphere.test", role, token: "token", lastLoginAt: "2026-10-07T01:00:00.000Z" }),
  );
}

beforeEach(() => {
  signIn();
  window.location.hash = "#/equipment/new";
  vi.mocked(equipmentApi.getEquipmentType).mockResolvedValue(bulkType);
  vi.mocked(equipmentApi.updateEquipmentType).mockResolvedValue(bulkType);
});

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.clearAllMocks();
});

describe("P2 equipment inventory", () => {
  it("creates a serialized type from its individually tracked unit labels", async () => {
    render(<App />);
    await screen.findByRole("heading", { name: "New equipment type" });

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Projector" } });
    fireEvent.change(screen.getByLabelText("Tracking method"), { target: { value: "SERIALIZED" } });
    fireEvent.change(screen.getByLabelText("Unit labels (one per line)"), { target: { value: "PROJ-01\nPROJ-02" } });
    fireEvent.click(screen.getByRole("button", { name: "Save equipment type" }));

    await waitFor(() => expect(equipmentApi.createEquipmentType).toHaveBeenCalledWith("token", expect.objectContaining({
      name: "Projector",
      kind: "SERIALIZED",
      totalQuantity: null,
      unitLabels: ["PROJ-01", "PROJ-02"],
    })));
  });

  it("shows the server's affected event references when a stock reduction is refused", async () => {
    window.location.hash = `#/equipment/${TYPE_ID}/edit`;
    vi.mocked(equipmentApi.updateEquipmentType).mockRejectedValueOnce(new ApiError(409, {
      code: "INSUFFICIENT_EQUIPMENT",
      message: "Total quantity cannot be reduced to 4: EVT-000042 reserves 6 units.",
      correlationId: "correlation-id",
    }));
    render(<App />);
    await screen.findByRole("heading", { name: "Maintain equipment type" });

    fireEvent.change(screen.getByLabelText("Total quantity held"), { target: { value: "4" } });
    fireEvent.click(screen.getByRole("button", { name: "Save equipment type" }));

    expect(await screen.findByText("Total quantity cannot be reduced to 4: EVT-000042 reserves 6 units.")).toBeTruthy();
  });

  it("marks one selected serialized unit unavailable for the entered period and reason", async () => {
    window.location.hash = `#/equipment/${TYPE_ID}/edit`;
    vi.mocked(equipmentApi.getEquipmentType).mockResolvedValue({
      ...bulkType,
      name: "Projector",
      kind: "SERIALIZED",
      totalQuantity: null,
      unitLabels: ["PROJ-01"],
      units: [{ id: UNIT_ID, label: "PROJ-01" }],
    });
    render(<App />);
    await screen.findByRole("heading", { name: "Maintain equipment type" });

    fireEvent.change(screen.getByLabelText("Unit"), { target: { value: UNIT_ID } });
    fireEvent.change(screen.getByLabelText("Unavailable from"), { target: { value: "2026-12-01T09:00" } });
    fireEvent.change(screen.getByLabelText("Unavailable until"), { target: { value: "2026-12-01T13:00" } });
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Lamp replacement" } });
    fireEvent.click(screen.getByRole("button", { name: "Mark unavailable" }));

    await waitFor(() => expect(equipmentApi.addEquipmentUnavailability).toHaveBeenCalledWith("token", TYPE_ID, {
      unitId: UNIT_ID,
      quantity: null,
      startsAt: new Date("2026-12-01T09:00").toISOString(),
      endsAt: new Date("2026-12-01T13:00").toISOString(),
      reason: "Lamp replacement",
    }));
  });

  it("shows who changed inventory, when, and the previous and new quantities", async () => {
    window.location.hash = `#/equipment/${TYPE_ID}/edit`;
    vi.mocked(equipmentApi.getEquipmentType).mockResolvedValue({
      ...bulkType,
      history: [{
        id: "history-id",
        action: "TYPE_UPDATED",
        previousQuantity: 100,
        newQuantity: 120,
        changes: { totalQuantity: { previous: 100, new: 120 } },
        actorUserId: "tech-id",
        actorRole: "TECH_SUPPORT_STAFF",
        occurredAt: "2026-10-07T01:00:00.000Z",
      }],
    });
    render(<App />);

    const history = await screen.findByRole("region", { name: "Inventory history" });
    expect(history.textContent).toContain("Inventory updated");
    expect(history.textContent).toContain("100 → 120");
    expect(history.textContent).toContain("tech-id");
    expect(history.textContent).toContain("7 Oct 2026");
  });

  it("does not expose inventory routes or make inventory requests for another role", async () => {
    sessionStorage.clear();
    signIn("EVENT_COORDINATOR");
    window.location.hash = "#/equipment";
    render(<App />);

    await screen.findByRole("link", { name: "Review queue" });
    expect(screen.queryByRole("link", { name: "Equipment" })).toBeNull();
    expect(equipmentApi.listEquipmentTypes).not.toHaveBeenCalled();
  });
});
