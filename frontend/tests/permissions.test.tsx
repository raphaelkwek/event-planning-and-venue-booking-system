import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

/**
 * EN-07 (EN-07-T4): the navigation and the route guard come from the server's
 * policies. The console sends one POST /api/v1/permissions/check per session,
 * naming each screen's resource and action and no role, and offers only what
 * comes back allowed. Every other screen test answers that request from
 * policies/ (tests/setup.ts); this one checks the request itself.
 */

vi.unmock("../src/api/permissions.js");

const { App } = await import("../src/App.js");

type Check = { kind: string; action: string };
let allowed: string[] = [];
let permissionStatus = 200;
const asked: { body: { checks: Check[] }; authorization: string | null }[] = [];

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

beforeEach(() => {
  asked.length = 0;
  permissionStatus = 200;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init?: RequestInit) => {
      if (String(input).endsWith("/api/v1/permissions/check")) {
        const body = JSON.parse(String(init?.body)) as { checks: Check[] };
        asked.push({ body, authorization: new Headers(init?.headers).get("authorization") });
        if (permissionStatus !== 200) {
          return reply(
            { error: { code: "POLICY_UNAVAILABLE", message: "Your permissions could not be checked because the permission service is unavailable. Nothing was changed.", correlationId: null } },
            permissionStatus
          );
        }
        return reply({
          results: body.checks.map((check) => {
            const ok = allowed.includes(`${check.kind}:${check.action}`);
            return { ...check, allowed: ok, reach: ok ? "ALWAYS" : "NEVER" };
          }),
        });
      }
      return reply({ items: [], nextCursor: null, unreadCount: 0 });
    })
  );
});

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

function signInAs(role: string, path: string) {
  sessionStorage.setItem(
    "connectsphere.session",
    JSON.stringify({ userId: "u-1", email: "user@connectsphere.test", role, token: "token-1", lastLoginAt: "2026-11-03T01:00:00.000Z" })
  );
  window.location.hash = `#${path}`;
}

// The staff console's primary navigation (#97's shell groups it; the order is the shell's, so compare as sets).
const navLabels = () => Array.from(document.querySelectorAll('nav[aria-label="Primary"] a')).map((link) => link.textContent ?? "").sort();

describe("navigation from the policies (EN-07-T4)", () => {
  it("EN-07-T4 asks once, with the token and every screen's resource and action but no role, and offers only what is allowed", async () => {
    allowed = ["event:create", "event:view_draft", "venue:view"];
    signInAs("EVENT_ORGANISER", "/requests");
    render(<App />);

    await waitFor(() => expect(navLabels()).toContain("My requests"));
    expect(navLabels()).toEqual(["API console", "My requests", "New request", "Notifications", "Venues"]);
    expect(asked).toHaveLength(1);
    expect(asked[0]!.authorization).toBe("Bearer token-1");
    expect(Object.keys(asked[0]!.body)).toEqual(["checks"]);
    expect(JSON.stringify(asked[0]!.body)).not.toMatch(/EVENT_ORGANISER|role|principal/);
    expect(asked[0]!.body.checks).toEqual(expect.arrayContaining([
      { kind: "event", action: "review" },
      { kind: "booking_request", action: "view_queue" },
      { kind: "event", action: "assign" },
    ]));
    expect(new Set(asked[0]!.body.checks.map((check) => `${check.kind}:${check.action}`)).size).toBe(asked[0]!.body.checks.length);
  });

  it("EN-07-T4 a screen the policies don't allow lands on the role's start page instead", async () => {
    allowed = ["booking_request:view_queue", "venue:view"];
    signInAs("VENUE_STAFF", "/queue");
    render(<App />);

    await waitFor(() => expect(navLabels()).toEqual(["API console", "Booking requests", "Hold requests", "Notifications", "Venues"]));
    await waitFor(() => expect(window.location.hash).toBe("#/console"));
    expect(screen.queryByText("Review queue")).toBeNull();
  });

  it("EN-07-T4 fails closed: when the permissions can't be checked, no protected screen opens and only the console is offered", async () => {
    permissionStatus = 503;
    signInAs("EVENT_COORDINATOR", "/queue");
    render(<App />);

    expect(await screen.findByText("Your permissions could not be checked")).toBeTruthy();
    expect(screen.getByText(/permission service is unavailable/)).toBeTruthy();
    expect(navLabels()).toEqual(["API console", "Notifications"]);
  });
});
