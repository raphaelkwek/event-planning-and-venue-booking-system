import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ApiError } from "../src/api/client.js";
import type { OpenEvent, RegistrationView, WaitingRoomPlace } from "../src/api/registration.js";
import { POLL_MS, POLL_RETRIES, waitText } from "../src/screens/WaitingRoom.js";

/**
 * EN-19 — the waiting screen on the attendee surface: it joins the queue,
 * shows the position and estimated wait, polls until the attendee is
 * admitted, then registers with the admission token. The queue itself, the
 * token and its rules are the server's and are tested there.
 */

const symposium: OpenEvent = {
  eventId: "e-1",
  reference: "EVT-000123",
  name: "R Test Symposium",
  description: null,
  startsAt: "2026-12-16T06:00:00.000Z",
  endsAt: "2026-12-16T10:00:00.000Z",
  venues: [],
  registrationOpensAt: "2026-12-01T01:00:00.000Z",
  registrationClosesAt: "2026-12-10T10:00:00.000Z",
  withdrawalDeadline: null,
  placesRemaining: 3,
  isFull: false,
  highDemand: true,
};

const placeAt = (over: Partial<WaitingRoomPlace>): WaitingRoomPlace => ({
  entryId: "entry-1",
  eventId: "e-1",
  status: "WAITING",
  position: 3,
  estimatedWaitSeconds: 3,
  admitAt: "2026-12-05T02:00:03.000Z",
  expiresAt: "2026-12-05T02:05:03.000Z",
  admissionToken: null,
  ...over,
});
const admitted = placeAt({ status: "ADMITTED", position: 0, estimatedWaitSeconds: 0, admissionToken: "v1.token.sig" });

const registration: RegistrationView = {
  id: "r-1",
  reference: "REG-000042",
  status: "REGISTERED",
  registeredAt: "2026-12-05T02:00:04.000Z",
  withdrawnAt: null,
  cancelledAt: null,
  event: { eventId: "e-1", reference: "EVT-000123", name: "R Test Symposium", startsAt: symposium.startsAt, endsAt: symposium.endsAt, venues: [], withdrawalDeadline: null },
};

const refusal = (status: number, code: string, message: string) => new ApiError(status, { code, message, correlationId: null });

const api = vi.hoisted(() => ({
  getOpenEvent: vi.fn(),
  joinWaitingRoom: vi.fn(),
  getWaitingRoomPlace: vi.fn(),
  registerFor: vi.fn(),
}));
vi.mock("../src/api/registration.js", async () => {
  const actual = await vi.importActual<typeof import("../src/api/registration.js")>("../src/api/registration.js");
  return { ...actual, ...api };
});
vi.mock("../src/api/notifications.js", async () => {
  const actual = await vi.importActual<typeof import("../src/api/notifications.js")>("../src/api/notifications.js");
  return { ...actual, listNotifications: vi.fn(async () => ({ items: [], unreadCount: 0, nextCursor: null })) };
});

const { App } = await import("../src/App.js");

function signInAsAttendee(hash: string) {
  sessionStorage.setItem(
    "connectsphere.session",
    JSON.stringify({ userId: "user-id", email: "attendee@connectsphere.test", role: "ATTENDEE", token: "token", lastLoginAt: "2026-12-01T01:00:00.000Z" }),
  );
  window.location.hash = hash;
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  for (const fn of Object.values(api)) fn.mockReset();
  api.getOpenEvent.mockResolvedValue(symposium);
});
afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.useRealTimers();
});

const tick = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));

describe("the waiting screen (EN-19)", () => {
  it("EN-19-T14 queues the attendee, polls until admitted, then registers with the token", async () => {
    api.joinWaitingRoom.mockResolvedValue(placeAt({}));
    api.getWaitingRoomPlace
      .mockResolvedValueOnce(placeAt({ position: 1, estimatedWaitSeconds: 1 }))
      .mockResolvedValueOnce(admitted);
    api.registerFor.mockResolvedValue(registration);
    signInAsAttendee("#/open-events/e-1/waiting-room");
    render(<App />);

    expect(await screen.findByRole("heading", { name: "You are in the queue" })).toBeTruthy();
    expect(await screen.findByText("Your position: 3")).toBeTruthy();
    expect(screen.getByText("Estimated wait: about 3 seconds.")).toBeTruthy();
    expect(screen.getByText(/R Test Symposium is a high-demand event/)).toBeTruthy();
    expect(api.joinWaitingRoom).toHaveBeenCalledWith("token", "e-1");
    expect(api.getWaitingRoomPlace).not.toHaveBeenCalled();

    await tick(POLL_MS);
    expect(api.getWaitingRoomPlace).toHaveBeenCalledWith("token", "entry-1");
    expect(await screen.findByText("Your position: 1")).toBeTruthy();
    expect(screen.getByText("Estimated wait: about 1 second.")).toBeTruthy();
    expect(api.registerFor).not.toHaveBeenCalled();

    await tick(POLL_MS);
    expect(api.registerFor).toHaveBeenCalledWith("token", "e-1", "v1.token.sig");
    expect(await screen.findByText("You are registered")).toBeTruthy();
    expect(screen.getByText("Registration REG-000042 for R Test Symposium is confirmed.")).toBeTruthy();

    await tick(POLL_MS * 3);
    expect(api.getWaitingRoomPlace).toHaveBeenCalledTimes(2);
    expect(api.registerFor).toHaveBeenCalledTimes(1);
  });

  it("EN-19-T14 registers at once when the attendee is admitted on joining, with nobody ahead", async () => {
    api.joinWaitingRoom.mockResolvedValue(admitted);
    api.registerFor.mockResolvedValue(registration);
    signInAsAttendee("#/open-events/e-1/waiting-room");
    render(<App />);

    expect(await screen.findByText("You are registered")).toBeTruthy();
    expect(api.registerFor).toHaveBeenCalledWith("token", "e-1", "v1.token.sig");
    expect(api.getWaitingRoomPlace).not.toHaveBeenCalled();
  });

  it("EN-19-T14 stops polling when the screen is closed", async () => {
    api.joinWaitingRoom.mockResolvedValue(placeAt({}));
    api.getWaitingRoomPlace.mockResolvedValue(placeAt({ position: 2 }));
    signInAsAttendee("#/open-events/e-1/waiting-room");
    const { unmount } = render(<App />);
    await screen.findByText("Your position: 3");
    await tick(POLL_MS);
    expect(api.getWaitingRoomPlace).toHaveBeenCalledTimes(1);

    unmount();
    await tick(POLL_MS * 5);

    expect(api.getWaitingRoomPlace).toHaveBeenCalledTimes(1);
  });

  it("EN-19-T14 says the turn has passed when the place expired while the page was away, and joins again on request", async () => {
    api.joinWaitingRoom.mockResolvedValueOnce(placeAt({})).mockResolvedValueOnce(placeAt({ entryId: "entry-2", position: 5, estimatedWaitSeconds: 5 }));
    api.getWaitingRoomPlace.mockResolvedValueOnce(placeAt({ status: "EXPIRED", position: 0, estimatedWaitSeconds: 0 }));
    signInAsAttendee("#/open-events/e-1/waiting-room");
    render(<App />);
    await screen.findByText("Your position: 3");

    await tick(POLL_MS);
    expect(await screen.findAllByText("Your turn has passed")).not.toHaveLength(0);
    expect(api.registerFor).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Join the queue again" }));
    expect(await screen.findByText("Your position: 5")).toBeTruthy();
    expect(api.joinWaitingRoom).toHaveBeenCalledTimes(2);
  });

  it("EN-19-T14 shows the server's words when the token had expired by the time it was used, and offers a new place", async () => {
    api.joinWaitingRoom.mockResolvedValueOnce(admitted).mockResolvedValueOnce(placeAt({ entryId: "entry-2" }));
    api.registerFor.mockRejectedValue(refusal(403, "ADMISSION_EXPIRED", "Your turn to register for EVT-000123 has passed. Join the waiting room again."));
    signInAsAttendee("#/open-events/e-1/waiting-room");
    render(<App />);

    expect(await screen.findByText("Your turn to register for EVT-000123 has passed. Join the waiting room again.")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Your turn has passed" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Join the queue again" }));
    expect(await screen.findByText("Your position: 3")).toBeTruthy();
  });

  it("EN-19-T14 shows a refusal to join, and a failed poll offers to try again", async () => {
    api.joinWaitingRoom.mockRejectedValueOnce(refusal(409, "WAITING_ROOM_NOT_REQUIRED", "EVT-000123 is not a high-demand event, so it has no waiting room."));
    signInAsAttendee("#/open-events/e-1/waiting-room");
    render(<App />);
    expect(await screen.findByText("EVT-000123 is not a high-demand event, so it has no waiting room.")).toBeTruthy();

    api.joinWaitingRoom.mockResolvedValueOnce(placeAt({}));
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Your position: 3")).toBeTruthy();
    expect(screen.queryByText("The waiting room could not be reached")).toBeNull();
  });

  it("EN-19-T14 keeps polling through a rate limit or a dropped connection instead of ending the queue", async () => {
    api.joinWaitingRoom.mockResolvedValue(placeAt({}));
    api.getWaitingRoomPlace
      .mockRejectedValueOnce(refusal(429, "RATE_LIMITED", "Too many requests."))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(placeAt({ position: 1, estimatedWaitSeconds: 1 }));
    signInAsAttendee("#/open-events/e-1/waiting-room");
    render(<App />);
    await screen.findByText("Your position: 3");

    await tick(POLL_MS * 3);

    expect(await screen.findByText("Your position: 1")).toBeTruthy();
    expect(screen.queryByText("The waiting room could not be reached")).toBeNull();
    expect(api.getWaitingRoomPlace).toHaveBeenCalledTimes(3);
  });

  it("EN-19-T14 gives up and offers to try again after repeated poll failures, and says so", async () => {
    api.joinWaitingRoom.mockResolvedValue(placeAt({}));
    api.getWaitingRoomPlace.mockRejectedValue(refusal(503, "IDENTITY_UNAVAILABLE", "The service is unavailable."));
    signInAsAttendee("#/open-events/e-1/waiting-room");
    render(<App />);
    await screen.findByText("Your position: 3");

    await tick(POLL_MS * 6);

    expect(await screen.findByText("The waiting room could not be reached")).toBeTruthy();
    expect(api.getWaitingRoomPlace).toHaveBeenCalledTimes(1 + POLL_RETRIES);
  });

  it("EN-19-T14 offers to try registering again when the registration failed for a reason that may pass", async () => {
    api.joinWaitingRoom.mockResolvedValue(admitted);
    api.registerFor.mockRejectedValueOnce(refusal(503, "IDENTITY_UNAVAILABLE", "Who you are could not be checked.")).mockResolvedValueOnce(registration);
    signInAsAttendee("#/open-events/e-1/waiting-room");
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Try registering again" }));

    expect(await screen.findByText("You are registered")).toBeTruthy();
    expect(api.registerFor).toHaveBeenCalledTimes(2);
    expect(api.joinWaitingRoom).toHaveBeenCalledTimes(1);
  });

  it("EN-19-T14 says a spent place was used, pointing to the registrations", async () => {
    api.joinWaitingRoom.mockResolvedValue(placeAt({ status: "USED", position: 0, estimatedWaitSeconds: 0 }));
    signInAsAttendee("#/open-events/e-1/waiting-room");
    render(<App />);

    expect(await screen.findByText("You have already used this turn")).toBeTruthy();
    expect(screen.getAllByRole("link", { name: "My registrations" }).every((link) => link.getAttribute("href") === "#/my-registrations")).toBe(true);
  });

  it("EN-19-T14 offers a high-demand event's attendee the waiting room instead of Register", async () => {
    api.getOpenEvent.mockResolvedValue(symposium);
    api.joinWaitingRoom.mockResolvedValue(placeAt({}));
    signInAsAttendee("#/open-events/e-1");
    render(<App />);

    const join = await screen.findByRole("button", { name: "Join the waiting room" });
    expect(screen.queryByRole("button", { name: "Register" })).toBeNull();
    fireEvent.click(join);

    expect(await screen.findByRole("heading", { name: "You are in the queue" })).toBeTruthy();
    expect(window.location.hash).toBe("#/open-events/e-1/waiting-room");
  });

  it("EN-19-T14 keeps Register for an event that is not high-demand", async () => {
    api.getOpenEvent.mockResolvedValue({ ...symposium, highDemand: false });
    signInAsAttendee("#/open-events/e-1");
    render(<App />);

    expect(await screen.findByRole("button", { name: "Register" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Join the waiting room" })).toBeNull();
  });

  it("EN-19-T14 sends an attendee whose plain register was refused for want of a token to the waiting room", async () => {
    api.getOpenEvent.mockResolvedValue({ ...symposium, highDemand: false });
    api.registerFor.mockRejectedValue(refusal(403, "ADMISSION_REQUIRED", "EVT-000123 is a high-demand event, so you must join its waiting room."));
    signInAsAttendee("#/open-events/e-1");
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Register" }));

    expect(await screen.findByText("EVT-000123 is a high-demand event, so you must join its waiting room.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Join the waiting room" })).toBeTruthy();
  });
});

describe("waitText", () => {
  it("EN-19-T14 says the wait in words an attendee can use", () => {
    expect(waitText(0)).toBe("no wait");
    expect(waitText(1)).toBe("about 1 second");
    expect(waitText(45)).toBe("about 45 seconds");
    expect(waitText(60)).toBe("about 1 minute");
    expect(waitText(61)).toBe("about 2 minutes");
    expect(waitText(600)).toBe("about 10 minutes");
  });
});
