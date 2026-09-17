import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

/**
 * Regression: signing out from a coordinator-only screen and signing in as a
 * different role used to land the new user on that same screen, because the
 * address was never reset.
 */

vi.mock("../src/api/session.js", async () => {
  const actual = await vi.importActual<typeof import("../src/api/session.js")>("../src/api/session.js");
  return {
    ...actual,
    logIn: vi.fn(async (email: string) => ({
      userId: email.startsWith("coordinator") ? "coordinator-id" : "organiser-id",
      email,
      role: email.startsWith("coordinator") ? "EVENT_COORDINATOR" : "EVENT_ORGANISER",
      token: "token",
      lastLoginAt: new Date().toISOString(),
    })),
    logOut: vi.fn(async () => undefined),
  };
});

vi.mock("../src/api/events.js", async () => {
  const actual = await vi.importActual<typeof import("../src/api/events.js")>("../src/api/events.js");
  const empty = async () => ({ items: [], nextCursor: null });
  return { ...actual, listQueue: vi.fn(empty), listRequests: vi.fn(empty) };
});

const { App } = await import("../src/App.js");

function signedInAs(role: "EVENT_COORDINATOR" | "EVENT_ORGANISER", hash: string) {
  sessionStorage.setItem(
    "connectsphere.session",
    JSON.stringify({
      userId: role === "EVENT_COORDINATOR" ? "coordinator-id" : "organiser-id",
      email: role === "EVENT_COORDINATOR" ? "coordinator@connectsphere.test" : "organiser@connectsphere.test",
      role,
      token: "token",
      lastLoginAt: new Date().toISOString(),
    })
  );
  window.location.hash = hash;
}

beforeEach(() => {
  sessionStorage.clear();
  window.location.hash = "";
});

afterEach(cleanup);

describe("signing out and in as a different role", () => {
  it("lands the new user on their own screen, not the previous user's", async () => {
    signedInAs("EVENT_COORDINATOR", "#/queue");
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Review queue" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    const email = await screen.findByLabelText("Email");
    fireEvent.change(email, { target: { value: "organiser@connectsphere.test" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("heading", { name: "My requests" })).toBeTruthy();
    await waitFor(() => expect(window.location.hash).toBe("#/requests"));
    expect(screen.queryByRole("heading", { name: "Review queue" })).toBeNull();
  });
});

describe("opening a screen the role may not use", () => {
  it("sends an organiser who follows a coordinator link to their own screen", async () => {
    signedInAs("EVENT_ORGANISER", "#/queue");
    render(<App />);

    expect(await screen.findByRole("heading", { name: "My requests" })).toBeTruthy();
    await waitFor(() => expect(window.location.hash).toBe("#/requests"));
    expect(screen.queryByRole("heading", { name: "Review queue" })).toBeNull();
  });
});
