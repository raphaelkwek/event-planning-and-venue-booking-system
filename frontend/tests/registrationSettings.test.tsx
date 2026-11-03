import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ApiError } from "../src/api/client.js";
import type { EventRecord } from "../src/api/types.js";

/**
 * R2, R4 — the owning organiser's registration settings screen: the window and
 * the withdrawal deadline, entered in Singapore time and sent with the version
 * loaded. The rules are the server's; the screen shows its field errors.
 */

const event = {
  id: "e-1",
  reference: "EVT-000123",
  ownerId: "user-id",
  name: "Annual Research Symposium",
  status: "APPROVED",
  proposedStartAt: "2026-12-02T06:00:00.000Z",
  proposedEndAt: "2026-12-02T10:00:00.000Z",
  registrationRequired: false,
  registrationOpensAt: null,
  registrationClosesAt: null,
  withdrawalDeadlineAt: null,
  version: 4,
} as unknown as EventRecord;

const mocks = vi.hoisted(() => ({ openEvent: vi.fn(), saveRegistrationSettings: vi.fn() }));
vi.mock("../src/api/events.js", async () => {
  const actual = await vi.importActual<typeof import("../src/api/events.js")>("../src/api/events.js");
  return { ...actual, openEvent: mocks.openEvent };
});
vi.mock("../src/api/registration.js", async () => {
  const actual = await vi.importActual<typeof import("../src/api/registration.js")>("../src/api/registration.js");
  return { ...actual, saveRegistrationSettings: mocks.saveRegistrationSettings };
});
vi.mock("../src/api/notifications.js", async () => {
  const actual = await vi.importActual<typeof import("../src/api/notifications.js")>("../src/api/notifications.js");
  return { ...actual, listNotifications: vi.fn(async () => ({ items: [], unreadCount: 0, nextCursor: null })) };
});

const { App } = await import("../src/App.js");

beforeEach(() => {
  mocks.openEvent.mockReset().mockResolvedValue(event);
  mocks.saveRegistrationSettings.mockReset();
  sessionStorage.setItem(
    "connectsphere.session",
    JSON.stringify({ userId: "user-id", email: "organiser@connectsphere.test", role: "EVENT_ORGANISER", token: "token", lastLoginAt: "2026-10-04T01:00:00.000Z" }),
  );
  window.location.hash = "#/events/e-1/registration";
});
afterEach(() => {
  cleanup();
  sessionStorage.clear();
});

const set = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

async function fillWindow(deadline?: [string, string]) {
  render(<App />);
  fireEvent.click(await screen.findByLabelText(/Attendees register for this event/));
  set("Registration opens date", "2026-12-01");
  set("Registration opens time", "09:00");
  set("Registration closes date", "2026-12-02");
  set("Registration closes time", "12:00");
  if (deadline) {
    set("Withdrawal deadline (optional) date", deadline[0]);
    set("Withdrawal deadline (optional) time", deadline[1]);
  }
  fireEvent.click(screen.getByRole("button", { name: "Save registration settings" }));
}

describe("Registration settings (R2, R4)", () => {
  it("R2-T11 R4-T8 sends the window and the deadline in Singapore time, with the version loaded", async () => {
    mocks.saveRegistrationSettings.mockResolvedValue({ ...event, registrationRequired: true, version: 5 });
    await fillWindow(["2026-12-02", "13:00"]);

    expect(await screen.findByText("Registration settings saved.")).toBeTruthy();
    expect(mocks.saveRegistrationSettings).toHaveBeenCalledWith("token", "e-1", 4, {
      registrationRequired: true,
      registrationOpensAt: "2026-12-01T09:00:00+08:00",
      registrationClosesAt: "2026-12-02T12:00:00+08:00",
      withdrawalDeadlineAt: "2026-12-02T13:00:00+08:00",
    });
  });

  it("R4-T8 sends no deadline when it is left empty", async () => {
    mocks.saveRegistrationSettings.mockResolvedValue({ ...event, version: 5 });
    await fillWindow();
    await screen.findByText("Registration settings saved.");
    expect(mocks.saveRegistrationSettings.mock.calls[0]![3]).toMatchObject({ withdrawalDeadlineAt: null });
  });

  it("R4-T8 shows the server's message under the field it names, and says nothing was saved", async () => {
    mocks.saveRegistrationSettings.mockRejectedValue(
      new ApiError(400, {
        code: "VALIDATION_FAILED",
        message: "The registration settings could not be saved. Check the highlighted fields.",
        fields: [{ field: "withdrawalDeadlineAt", message: "The withdrawal deadline must be no later than the event start." }],
        correlationId: null,
      }),
    );
    await fillWindow(["2026-12-02", "15:00"]);

    expect((await screen.findByRole("alert")).textContent).toBe("The withdrawal deadline must be no later than the event start.");
    expect(screen.queryByText("Registration settings saved.")).toBeNull();
  });

  it("loads the saved settings into the form, and sends an empty window when registration is off", async () => {
    mocks.openEvent.mockResolvedValue({
      ...event,
      registrationRequired: true,
      registrationOpensAt: "2026-12-01T01:00:00.000Z",
      registrationClosesAt: "2026-12-02T04:00:00.000Z",
    });
    mocks.saveRegistrationSettings.mockResolvedValue({ ...event, version: 5 });
    render(<App />);
    await waitFor(() => expect((screen.getByLabelText("Registration opens time") as HTMLInputElement).value).toBe("09:00"));
    expect((screen.getByLabelText("Registration closes date") as HTMLInputElement).value).toBe("2026-12-02");

    fireEvent.click(screen.getByLabelText(/Attendees register for this event/));
    fireEvent.click(screen.getByRole("button", { name: "Save registration settings" }));

    await screen.findByText("Registration settings saved.");
    expect(mocks.saveRegistrationSettings.mock.calls[0]![3]).toEqual({
      registrationRequired: false,
      registrationOpensAt: null,
      registrationClosesAt: null,
      withdrawalDeadlineAt: null,
    });
  });
});
