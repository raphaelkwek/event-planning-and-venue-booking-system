import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { request, ServiceUnreachableError } from "../src/api/client.js";
import { Refusal } from "../src/components/Refusal.js";

/**
 * D10 (staging dry run, 4 Nov 2026): during a redeploy, My requests showed "Something went wrong:
 * Failed to fetch" and "No requests yet. Create one to get started." together, and one read came back
 * as a page that was not the service's answer. A request that never reaches a service, or whose
 * answer cannot be read, now fails with one plain message, and a list that cannot load shows only
 * that, with Try again, never the empty list.
 */

const reply = (body: string, status = 200) => new Response(body, { status });

const listItem = {
  id: "e1",
  kind: "EVENT",
  status: "SUBMITTED",
  name: "Annual Research Symposium",
  reference: "EVT-000001",
  lastSavedAt: null,
  submittedAt: "2026-09-17T01:00:00.000Z",
  assignedCoordinatorId: null,
  decidedAt: null,
};

let failNextList: "network" | "page" | null;
const fetchMock = vi.fn(async (path: string) => {
  const url = new URL(path, "http://app.test");
  if (url.pathname === "/event/api/v1/events") {
    const failure = failNextList;
    failNextList = null;
    if (failure === "network") throw new TypeError("Failed to fetch");
    if (failure === "page") return reply("<html><body>Bad gateway</body></html>");
    return reply(JSON.stringify({ items: [listItem], nextCursor: null }));
  }
  if (url.pathname.includes("/notifications")) return reply(JSON.stringify({ items: [], unreadCount: 0, nextCursor: null }));
  if (url.pathname.startsWith("/identity/api/v1/users")) return reply(JSON.stringify({ items: [] }));
  return reply(JSON.stringify({ items: [] }));
});

const { App } = await import("../src/App.js");

beforeEach(() => {
  failNextList = null;
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

describe("the API client (D10)", () => {
  it("turns a request that never reached a service into one plain error", async () => {
    failNextList = "network";
    const failure = await request("/event/api/v1/events").catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ServiceUnreachableError);
    expect((failure as ServiceUnreachableError).message).toBe("ConnectSphere couldn't be reached. Check your connection, then try again.");
  });

  it("refuses a success whose body is not the service's JSON, rather than handing a screen a page of HTML", async () => {
    failNextList = "page";
    const failure = await request("/event/api/v1/events").catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ServiceUnreachableError);
    expect((failure as ServiceUnreachableError).reason).toBe("unreadable");
    expect((failure as ServiceUnreachableError).message).toBe("ConnectSphere sent an answer that could not be read, as can happen while it restarts. Try again in a moment.");
  });

  it("still returns a JSON success, and nothing for an empty one", async () => {
    expect(await request("/event/api/v1/events")).toEqual({ items: [listItem], nextCursor: null });
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    expect(await request("/event/api/v1/anything", { method: "POST" })).toBeNull();
  });
});

describe("Refusal (D10)", () => {
  it("titles a failure to reach the service in words, with its plain message and no raw browser error", () => {
    render(<Refusal error={new ServiceUnreachableError("unreachable", new TypeError("Failed to fetch"))} />);
    expect(screen.getByText("Couldn't reach ConnectSphere")).toBeTruthy();
    expect(screen.getByText("ConnectSphere couldn't be reached. Check your connection, then try again.")).toBeTruthy();
    expect(screen.queryByText("Failed to fetch")).toBeNull();
    expect(screen.queryByText("Something went wrong")).toBeNull();
  });
});

describe("My requests when the list cannot load (D10)", () => {
  function openMyRequests() {
    sessionStorage.setItem(
      "connectsphere.session",
      JSON.stringify({ userId: "organiser-id", email: "organiser@connectsphere.test", role: "EVENT_ORGANISER", token: "token", lastLoginAt: "2026-09-17T01:00:00.000Z" }),
    );
    window.location.hash = "#/requests";
    render(<App />);
  }

  it("shows one error with Try again and no empty list, then the list once it loads", async () => {
    failNextList = "network";
    openMyRequests();

    expect(await screen.findByText("Your requests couldn't be loaded")).toBeTruthy();
    expect(screen.getByText("ConnectSphere couldn't be reached. Check your connection, then try again.")).toBeTruthy();
    expect(screen.queryByText("No requests yet. Create one to get started.")).toBeNull();
    expect(screen.queryByText("Failed to fetch")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Annual Research Symposium")).toBeTruthy();
    expect(screen.queryByText("Your requests couldn't be loaded")).toBeNull();
  });

  it("says the same for an answer that is not the service's", async () => {
    failNextList = "page";
    openMyRequests();
    expect(await screen.findByText("Your requests couldn't be loaded")).toBeTruthy();
    expect(screen.queryByText("No requests yet. Create one to get started.")).toBeNull();
  });

  it("still says there are no requests when the list loads empty", async () => {
    fetchMock.mockImplementation(async (path: string) =>
      new URL(path, "http://app.test").pathname === "/event/api/v1/events"
        ? reply(JSON.stringify({ items: [], nextCursor: null }))
        : reply(JSON.stringify({ items: [], unreadCount: 0, nextCursor: null })),
    );
    openMyRequests();
    expect(await screen.findByText("No requests yet. Create one to get started.")).toBeTruthy();
  });
});
